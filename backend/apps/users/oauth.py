"""OAuth 2.0: VK ID, Яндекс ID, Mail.ru."""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.http import HttpRequest
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SocialAccount, UserProfile

logger = logging.getLogger(__name__)

PROVIDERS = frozenset({"vk", "yandex", "mailru"})
SESSION_STATE_KEY = "oauth_state"
SESSION_PKCE_KEY = "oauth_pkce"
SESSION_NEXT_KEY = "oauth_next"
SESSION_PROVIDER_KEY = "oauth_provider"


class OAuthError(Exception):
    pass


class OAuthConfigError(OAuthError):
    pass


@dataclass
class OAuthProfile:
    provider_user_id: str
    email: str = ""
    first_name: str = ""
    last_name: str = ""
    extra: dict[str, Any] | None = None


def _generate_state() -> str:
    return secrets.token_urlsafe(32)


def _generate_pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest())
        .rstrip(b"=")
        .decode("ascii")
    )
    return verifier, challenge


def _unique_username(base: str) -> str:
    cleaned = "".join(ch for ch in base if ch.isalnum() or ch in "._-").strip("._-")
    if not cleaned:
        cleaned = "user"
    username = cleaned[:150]
    if not User.objects.filter(username=username).exists():
        return username
    suffix = 1
    while True:
        candidate = f"{username[:140]}_{suffix}"
        if not User.objects.filter(username=candidate).exists():
            return candidate
        suffix += 1


def get_or_create_user(provider: str, profile: OAuthProfile) -> User:
    social = (
        SocialAccount.objects.filter(
            provider=provider,
            provider_user_id=profile.provider_user_id,
        )
        .select_related("user")
        .first()
    )
    if social:
        user = social.user
        _maybe_update_user(user, profile)
        return user

    user = None
    if profile.email:
        user = User.objects.filter(email__iexact=profile.email).first()

    if user is None:
        username_base = (
            profile.email.split("@")[0]
            if profile.email
            else f"{provider}_{profile.provider_user_id}"
        )
        user = User.objects.create_user(
            username=_unique_username(username_base),
            email=profile.email or "",
            password=User.objects.make_random_password(length=32),
            first_name=profile.first_name,
            last_name=profile.last_name,
        )
        UserProfile.objects.create(user=user, subscription_type="trial")
    else:
        _maybe_update_user(user, profile)

    SocialAccount.objects.create(
        user=user,
        provider=provider,
        provider_user_id=profile.provider_user_id,
        extra_data=profile.extra or {},
    )
    return user


def _maybe_update_user(user: User, profile: OAuthProfile) -> None:
    changed: list[str] = []
    if profile.email and not user.email:
        user.email = profile.email
        changed.append("email")
    if profile.first_name and not user.first_name:
        user.first_name = profile.first_name
        changed.append("first_name")
    if profile.last_name and not user.last_name:
        user.last_name = profile.last_name
        changed.append("last_name")
    if changed:
        user.save(update_fields=changed)


def issue_tokens(user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def build_frontend_callback_url(
    *,
    access: str | None = None,
    refresh: str | None = None,
    error: str | None = None,
    next_url: str | None = None,
) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    params: dict[str, str] = {}
    if error:
        params["error"] = error
    if access:
        params["access"] = access
    if refresh:
        params["refresh"] = refresh
    if next_url:
        params["next"] = next_url
    query = urlencode(params)
    return f"{base}/auth/callback?{query}" if query else f"{base}/auth/callback"


class BaseOAuthProvider:
    name: str = ""

    def __init__(self) -> None:
        self.client_id = ""
        self.client_secret = ""
        self.redirect_uri = ""

    def is_configured(self) -> bool:
        return bool(self.client_id and self.redirect_uri)

    def build_authorize_url(self, request: HttpRequest) -> str:
        raise NotImplementedError

    def handle_callback(self, request: HttpRequest) -> OAuthProfile:
        raise NotImplementedError

    def _save_session(self, request: HttpRequest, *, state: str, next_url: str, pkce: str = "") -> None:
        request.session[SESSION_STATE_KEY] = state
        request.session[SESSION_PROVIDER_KEY] = self.name
        request.session[SESSION_NEXT_KEY] = next_url
        if pkce:
            request.session[SESSION_PKCE_KEY] = pkce
        request.session.modified = True

    def _validate_state(self, request: HttpRequest, state: str) -> None:
        expected = request.session.get(SESSION_STATE_KEY)
        provider = request.session.get(SESSION_PROVIDER_KEY)
        if not expected or expected != state or provider != self.name:
            raise OAuthError("Неверный параметр state")
        request.session.pop(SESSION_STATE_KEY, None)
        request.session.pop(SESSION_PROVIDER_KEY, None)

    def _pop_pkce(self, request: HttpRequest) -> str:
        return request.session.pop(SESSION_PKCE_KEY, "") or ""


class VkOAuthProvider(BaseOAuthProvider):
    name = "vk"
    AUTHORIZE_URL = "https://id.vk.ru/authorize"
    TOKEN_URL = "https://id.vk.ru/oauth2/auth"
    USER_INFO_URL = "https://id.vk.ru/oauth2/user_info"

    def __init__(self) -> None:
        super().__init__()
        self.client_id = settings.VK_CLIENT_ID
        self.client_secret = settings.VK_CLIENT_SECRET
        self.redirect_uri = settings.VK_REDIRECT_URI

    def build_authorize_url(self, request: HttpRequest) -> str:
        if not self.is_configured():
            raise OAuthConfigError("VK OAuth не настроен (VK_CLIENT_ID, VK_REDIRECT_URI)")
        state = _generate_state()
        verifier, challenge = _generate_pkce()
        next_url = request.GET.get("next", "/")
        self._save_session(request, state=state, next_url=next_url, pkce=verifier)
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "scope": "email",
        }
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    def handle_callback(self, request: HttpRequest) -> OAuthProfile:
        error = request.GET.get("error")
        if error:
            raise OAuthError(request.GET.get("error_description") or error)
        code = request.GET.get("code")
        state = request.GET.get("state", "")
        device_id = request.GET.get("device_id", "")
        if not code:
            raise OAuthError("Код авторизации не получен")
        self._validate_state(request, state)
        verifier = self._pop_pkce(request)
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "code_verifier": verifier,
            "device_id": device_id,
            "state": state,
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret
        token_resp = requests.post(self.TOKEN_URL, data=data, timeout=30)
        if not token_resp.ok:
            logger.error("VK token error: %s", token_resp.text)
            raise OAuthError("Не удалось получить токен VK")
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise OAuthError("VK не вернул access_token")
        user_resp = requests.post(
            self.USER_INFO_URL,
            data={"access_token": access_token, "client_id": self.client_id},
            timeout=30,
        )
        if not user_resp.ok:
            logger.error("VK user_info error: %s", user_resp.text)
            raise OAuthError("Не удалось получить профиль VK")
        user_data = user_resp.json().get("user") or user_resp.json()
        user_id = str(user_data.get("user_id") or user_data.get("id") or "")
        if not user_id:
            raise OAuthError("VK не вернул ID пользователя")
        return OAuthProfile(
            provider_user_id=user_id,
            email=(user_data.get("email") or "").strip(),
            first_name=(user_data.get("first_name") or "").strip(),
            last_name=(user_data.get("last_name") or "").strip(),
            extra=user_data,
        )


class YandexOAuthProvider(BaseOAuthProvider):
    name = "yandex"
    AUTHORIZE_URL = "https://oauth.yandex.ru/authorize"
    TOKEN_URL = "https://oauth.yandex.ru/token"
    USER_INFO_URL = "https://login.yandex.ru/info"

    def __init__(self) -> None:
        super().__init__()
        self.client_id = settings.YANDEX_CLIENT_ID
        self.client_secret = settings.YANDEX_CLIENT_SECRET
        self.redirect_uri = settings.YANDEX_REDIRECT_URI

    def build_authorize_url(self, request: HttpRequest) -> str:
        if not self.is_configured():
            raise OAuthConfigError("Яндекс OAuth не настроен (YANDEX_CLIENT_ID, YANDEX_REDIRECT_URI)")
        state = _generate_state()
        next_url = request.GET.get("next", "/")
        self._save_session(request, state=state, next_url=next_url)
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "state": state,
        }
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    def handle_callback(self, request: HttpRequest) -> OAuthProfile:
        error = request.GET.get("error")
        if error:
            raise OAuthError(request.GET.get("error_description") or error)
        code = request.GET.get("code")
        state = request.GET.get("state", "")
        if not code:
            raise OAuthError("Код авторизации не получен")
        self._validate_state(request, state)
        token_resp = requests.post(
            self.TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=30,
        )
        if not token_resp.ok:
            logger.error("Yandex token error: %s", token_resp.text)
            raise OAuthError("Не удалось получить токен Яндекс")
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise OAuthError("Яндекс не вернул access_token")
        user_resp = requests.get(
            self.USER_INFO_URL,
            params={"format": "json"},
            headers={"Authorization": f"OAuth {access_token}"},
            timeout=30,
        )
        if not user_resp.ok:
            logger.error("Yandex user_info error: %s", user_resp.text)
            raise OAuthError("Не удалось получить профиль Яндекс")
        user_data = user_resp.json()
        user_id = str(user_data.get("id") or "")
        if not user_id:
            raise OAuthError("Яндекс не вернул ID пользователя")
        return OAuthProfile(
            provider_user_id=user_id,
            email=(user_data.get("default_email") or user_data.get("email") or "").strip(),
            first_name=(user_data.get("first_name") or "").strip(),
            last_name=(user_data.get("last_name") or "").strip(),
            extra=user_data,
        )


class MailruOAuthProvider(BaseOAuthProvider):
    name = "mailru"
    AUTHORIZE_URL = "https://o2.mail.ru/login"
    TOKEN_URL = "https://o2.mail.ru/token"
    USER_INFO_URL = "https://oauth.mail.ru/userinfo"

    def __init__(self) -> None:
        super().__init__()
        self.client_id = settings.MAILRU_CLIENT_ID
        self.client_secret = settings.MAILRU_CLIENT_SECRET
        self.redirect_uri = settings.MAILRU_REDIRECT_URI

    def build_authorize_url(self, request: HttpRequest) -> str:
        if not self.is_configured():
            raise OAuthConfigError("Mail.ru OAuth не настроен (MAILRU_CLIENT_ID, MAILRU_REDIRECT_URI)")
        state = _generate_state()
        next_url = request.GET.get("next", "/")
        self._save_session(request, state=state, next_url=next_url)
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": "userinfo",
            "state": state,
        }
        return f"{self.AUTHORIZE_URL}?{urlencode(params)}"

    def handle_callback(self, request: HttpRequest) -> OAuthProfile:
        error = request.GET.get("error")
        if error:
            raise OAuthError(request.GET.get("error_description") or error)
        code = request.GET.get("code")
        state = request.GET.get("state", "")
        if not code:
            raise OAuthError("Код авторизации не получен")
        self._validate_state(request, state)
        token_resp = requests.post(
            self.TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
                "redirect_uri": self.redirect_uri,
            },
            timeout=30,
        )
        if not token_resp.ok:
            logger.error("Mail.ru token error: %s", token_resp.text)
            raise OAuthError("Не удалось получить токен Mail.ru")
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise OAuthError("Mail.ru не вернул access_token")
        user_resp = requests.get(
            self.USER_INFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30,
        )
        if not user_resp.ok:
            logger.error("Mail.ru userinfo error: %s", user_resp.text)
            raise OAuthError("Не удалось получить профиль Mail.ru")
        user_data = user_resp.json()
        user_id = str(user_data.get("id") or user_data.get("client_id") or "")
        if not user_id:
            raise OAuthError("Mail.ru не вернул ID пользователя")
        name = (user_data.get("name") or user_data.get("nickname") or "").strip()
        first_name, _, last_name = name.partition(" ")
        return OAuthProfile(
            provider_user_id=user_id,
            email=(user_data.get("email") or "").strip(),
            first_name=first_name,
            last_name=last_name,
            extra=user_data,
        )


def get_provider(name: str) -> BaseOAuthProvider:
    if name not in PROVIDERS:
        raise OAuthError(f"Неизвестный провайдер: {name}")
    providers: dict[str, BaseOAuthProvider] = {
        "vk": VkOAuthProvider(),
        "yandex": YandexOAuthProvider(),
        "mailru": MailruOAuthProvider(),
    }
    return providers[name]
