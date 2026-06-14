from django.http import HttpResponseBadRequest
from django.shortcuts import redirect
from django.views import View

from .oauth import (
    OAuthConfigError,
    OAuthError,
    build_frontend_callback_url,
    get_or_create_user,
    get_provider,
    issue_tokens,
)


class OAuthStartView(View):
    """GET /api/auth/<provider>/ — редирект на страницу авторизации провайдера."""

    def get(self, request, provider: str):
        try:
            oauth_provider = get_provider(provider)
            url = oauth_provider.build_authorize_url(request)
            return redirect(url)
        except OAuthConfigError as exc:
            return HttpResponseBadRequest(str(exc))
        except OAuthError as exc:
            return redirect(build_frontend_callback_url(error=str(exc)))


class OAuthCallbackView(View):
    """GET /api/auth/<provider>/callback/ — обработка ответа провайдера, выдача JWT."""

    def get(self, request, provider: str):
        next_url = "/"
        try:
            oauth_provider = get_provider(provider)
            profile = oauth_provider.handle_callback(request)
            next_url = request.session.pop("oauth_next", "/") or "/"
            user = get_or_create_user(provider, profile)
            tokens = issue_tokens(user)
            return redirect(
                build_frontend_callback_url(
                    access=tokens["access"],
                    refresh=tokens["refresh"],
                    next_url=next_url,
                )
            )
        except OAuthConfigError as exc:
            return redirect(build_frontend_callback_url(error=str(exc), next_url=next_url))
        except OAuthError as exc:
            return redirect(build_frontend_callback_url(error=str(exc), next_url=next_url))
