"""
API для плагина (Revit и др.).
Авторизация: заголовок X-License-Hash (хеш ключа лицензии из профиля пользователя).
"""
import logging
import hashlib
import hmac
import re
from typing import Tuple

from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from apps.users.models import UserProfile
from apps.catalog.models import Product
from apps.downloads.models import Download

from django.http import HttpResponseRedirect
from .utils import resolve_product_file_url, resolve_file_by_name
from .connection import (
    build_plugin_connection_payload,
    build_local_file_candidate,
    send_plugin_activation_email,
)
from .tokens import (
    activation_payload,
    default_platforms_for_profile,
    issue_activation_token,
    resolve_profile_by_plain_token,
    resolve_profile_by_subdomain_key,
)

logger = logging.getLogger(__name__)

LICENSE_HEADER = 'X-License-Hash'
ACTIVATION_TOKEN_HEADER = 'X-Activation-Token'
LICENSE_RE = re.compile(r'^[a-f0-9]{64}$')
SUBDOMAIN_TOKEN_RE = re.compile(r'^[a-f0-9]{32}$')
REQUEST_CODE_RE = re.compile(r'^[a-fA-F0-9]{64}$')
LICENSE_INPUT_RE = re.compile(r'^[a-fA-F0-9]{64}$')


def compute_offline_activation_variants(request_code: str, license_hash: str) -> dict:
    """
    Варианты «кода активации» из кода запроса и хеша лицензии.
    Реальный плагин использует ровно одну формулу — режим подбирают (см. multi).
    """
    rc = request_code.strip().lower()
    lh = license_hash.strip().lower()
    base = {
        'sha256_rl': hashlib.sha256((rc + lh).encode('utf-8')).hexdigest(),
        'sha256_lr': hashlib.sha256((lh + rc).encode('utf-8')).hexdigest(),
        'sha256_pipe': hashlib.sha256(f'{rc}|{lh}'.encode('utf-8')).hexdigest(),
        'sha256_colon': hashlib.sha256(f'{rc}:{lh}'.encode('utf-8')).hexdigest(),
        'sha256_utf16le_rl': hashlib.sha256((rc + lh).encode('utf-16-le')).hexdigest(),
        'sha256_utf16be_rl': hashlib.sha256((rc + lh).encode('utf-16-be')).hexdigest(),
    }
    try:
        brc = bytes.fromhex(rc)
        blh = bytes.fromhex(lh)
    except ValueError:
        brc = blh = None
    if brc is not None and blh is not None and len(brc) == 32 and len(blh) == 32:
        # Как часто в C#: склейка байтов, не строк hex
        base['sha256_bytes_rl'] = hashlib.sha256(brc + blh).hexdigest()
        base['sha256_bytes_lr'] = hashlib.sha256(blh + brc).hexdigest()
        base['sha512_bytes_rl'] = hashlib.sha512(brc + blh).hexdigest()
        # HMAC: ключ = байты лицензии / кода запроса (без общего секрета)
        base['hmac_key_license_bytes_msg_request'] = hmac.new(blh, brc, hashlib.sha256).hexdigest()
        base['hmac_key_request_bytes_msg_license'] = hmac.new(brc, blh, hashlib.sha256).hexdigest()
        # MD5 — у части старых плагинов 32 hex в поле активации
        base['md5_bytes_rl'] = hashlib.md5(brc + blh).hexdigest()
        base['md5_bytes_lr'] = hashlib.md5(blh + brc).hexdigest()
    secret = (getattr(settings, 'PLUGIN_OFFLINE_ACTIVATION_SECRET', None) or '').strip()
    if secret:
        # Формула из ActivationManager.cs (3ds Max): sha256(request_code + secretKey)
        base['sha256_request_secret'] = hashlib.sha256(
            (rc + secret).encode('utf-8')
        ).hexdigest()
        # Запасной обратный порядок (на случай другой сборки)
        base['sha256_secret_request'] = hashlib.sha256(
            (secret + rc).encode('utf-8')
        ).hexdigest()
        base['hmac_sha256_rl'] = hmac.new(
            secret.encode('utf-8'), (rc + lh).encode('utf-8'), hashlib.sha256
        ).hexdigest()
        base['hmac_sha256_lr'] = hmac.new(
            secret.encode('utf-8'), (lh + rc).encode('utf-8'), hashlib.sha256
        ).hexdigest()
    return base


def single_offline_activation_code(request_code: str, license_hash: str) -> Tuple[str, str]:
    """Возвращает (activation_code, mode_used)."""
    mode = (getattr(settings, 'PLUGIN_OFFLINE_ACTIVATION_MODE', None) or 'sha256_rl').strip().lower()
    variants = compute_offline_activation_variants(request_code, license_hash)
    if mode == 'multi':
        raise ValueError('multi')
    if mode.startswith('hmac_') and mode not in variants:
        raise ValueError('PLUGIN_OFFLINE_ACTIVATION_SECRET is required for HMAC modes')
    if mode not in variants:
        mode = 'sha256_rl'
    return variants[mode], mode


def resolve_profile_by_license_value(license_value):
    """
    Ищет профиль по ключу/хешу лицензии.
    Поддержка:
    1) прямое совпадение (новый API),
    2) legacy-плагин, который повторно хеширует введённый ключ.
    """
    if not license_value:
        return None

    value = license_value.strip()
    if not value:
        return None

    # 1) Прямое совпадение по сохраненному hash
    profile = UserProfile.objects.filter(license_key_hash=value).first()
    if profile:
        return profile

    # 2) Legacy-совместимость: плагин шлёт sha256(введённое_значение),
    # а в поле license_key_hash может храниться уже hash.
    # Тогда сравниваем value с sha256(license_key_hash) по профилям.
    candidate_profiles = UserProfile.objects.exclude(
        license_key_hash__isnull=True
    ).exclude(
        license_key_hash=''
    )
    for candidate in candidate_profiles.only('id', 'license_key_hash'):
        candidate_hash = hashlib.sha256(candidate.license_key_hash.encode('utf-8')).hexdigest()
        if candidate_hash == value:
            return candidate

    return None


def resolve_license_from_host(request):
    """
    Поддержка URL с ключом в поддомене:
    - 64 hex — постоянный license_key_hash (legacy)
    - 32 hex — одноразовый activation token (новые письма)
    """
    try:
        host = (request.get_host() or '').split(':', 1)[0].lower().strip()
    except Exception:
        host = ''

    if not host or '.' not in host:
        return None

    first_label = host.split('.', 1)[0]
    if LICENSE_RE.match(first_label):
        return ('license', first_label)
    if SUBDOMAIN_TOKEN_RE.match(first_label):
        return ('activation_subdomain', first_label)
    return None


def get_profile_from_request(request):
    """UserProfile по X-Activation-Token, X-License-Hash или поддомену."""
    activation_plain = (
        request.headers.get(ACTIVATION_TOKEN_HEADER)
        or request.META.get(f'HTTP_{ACTIVATION_TOKEN_HEADER.upper().replace("-", "_")}')
    )
    if hasattr(request, 'query_params'):
        activation_plain = activation_plain or request.query_params.get('activation_token')
        activation_plain = activation_plain or request.query_params.get('k')
    elif hasattr(request, 'GET'):
        activation_plain = activation_plain or request.GET.get('activation_token')
        activation_plain = activation_plain or request.GET.get('k')
    if activation_plain:
        profile, token_row = resolve_profile_by_plain_token(str(activation_plain).strip())
        if profile and token_row and token_row.is_valid():
            request.plugin_activation_token = token_row
            return profile

    license_hash = request.headers.get(LICENSE_HEADER) or request.META.get(
        f'HTTP_{LICENSE_HEADER.upper().replace("-", "_")}'
    )
    profile = resolve_profile_by_license_value(license_hash)
    if profile:
        return profile

    host_info = resolve_license_from_host(request)
    if not host_info:
        return None
    kind, value = host_info
    if kind == 'license':
        return resolve_profile_by_license_value(value)
    profile, token_row = resolve_profile_by_subdomain_key(value)
    if profile and token_row and token_row.is_valid():
        request.plugin_activation_token = token_row
        return profile
    return None


def license_required(view_method):
    """Декоратор: проверяет лицензию, добавляет profile в request."""
    def wrapper(self, request, *args, **kwargs):
        profile = get_profile_from_request(request)
        if not profile:
            return Response(
                {"error": "Неверный или отсутствующий ключ лицензии. Добавьте заголовок X-License-Hash."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not profile.is_subscription_active():
            return Response(
                {"error": "Подписка не активна или истекла. Обновите подписку на сайте."},
                status=status.HTTP_403_FORBIDDEN
            )
        request.plugin_profile = profile
        return view_method(self, request, *args, **kwargs)
    return wrapper


class PluginActivateView(APIView):
    """
    POST /api/plugin/activate/
    Header: X-License-Hash
    Проверка лицензии. Возвращает valid, subscription_type, download_limit.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        profile = get_profile_from_request(request)
        if not profile:
            return Response(
                {"valid": False, "error": "Неверный ключ лицензии"},
                status=status.HTTP_200_OK
            )
        if not profile.is_subscription_active():
            return Response(
                {"valid": False, "error": "Подписка не активна или истекла"},
                status=status.HTTP_200_OK
            )
        limit = profile.get_download_limit()
        token_row = getattr(request, 'plugin_activation_token', None)
        connection = activation_payload(profile, token_row, mark_used=False)
        return Response({
            "valid": True,
            "subscription_type": profile.subscription_type,
            "subscription_type_display": profile.get_subscription_type_display(),
            "download_limit": limit,
            "user_id": profile.user_id,
            **connection,
        }, status=status.HTTP_200_OK)


class PluginActivateByTokenView(APIView):
    """
    POST /api/plugin/activate-by-token/
    Body: { "token": "<plain token from email>" }
    Одноразовая активация; помечает токен использованным.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        plain = (request.data.get('token') or request.data.get('activation_token') or '').strip()
        if not plain:
            return Response(
                {"valid": False, "error": "token обязателен (из письма)"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile, token_row = resolve_profile_by_plain_token(plain)
        if not profile or not token_row:
            return Response(
                {"valid": False, "error": "Токен не найден, истёк или отозван"},
                status=status.HTTP_200_OK,
            )
        if not profile.is_subscription_active():
            return Response(
                {"valid": False, "error": "Подписка не активна"},
                status=status.HTTP_200_OK,
            )
        payload = activation_payload(profile, token_row, mark_used=True)
        return Response({"valid": True, **payload}, status=status.HTTP_200_OK)


class PluginPlatformsView(APIView):
    """GET /api/plugin/platforms/ — список площадок (X-License-Hash)."""
    permission_classes = []
    authentication_classes = []

    @license_required
    def get(self, request):
        return Response(
            {"platforms": default_platforms_for_profile(request.plugin_profile)},
            status=status.HTTP_200_OK,
        )


class PluginLegacyLicenseView(APIView):
    """
    Legacy-совместимость с готовым плагином:
    POST /api/license.php
    Body: { license_hash, hardware_id, plugin_version, feature }
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        license_hash = (request.data.get('license_hash') or '').strip()
        if not license_hash:
            host_info = resolve_license_from_host(request)
            if host_info and host_info[0] == 'license':
                license_hash = host_info[1]
            elif host_info and host_info[0] == 'activation_subdomain':
                profile, _ = resolve_profile_by_subdomain_key(host_info[1])
                if profile:
                    license_hash = profile.license_key_hash or ''
        feature = (request.data.get('feature') or '').strip()

        if not license_hash:
            return Response(
                {
                    "valid": False,
                    "message": "license_hash is required",
                    "error_code": "LICENSE_MISSING",
                    "features": [],
                },
                status=status.HTTP_200_OK,
            )

        profile = resolve_profile_by_license_value(license_hash)
        if not profile:
            return Response(
                {
                    "valid": False,
                    "message": "invalid license key",
                    "error_code": "LICENSE_INVALID",
                    "features": [],
                },
                status=status.HTTP_200_OK,
            )

        if not profile.is_subscription_active():
            return Response(
                {
                    "valid": False,
                    "message": "subscription expired or inactive",
                    "error_code": "SUBSCRIPTION_INACTIVE",
                    "features": [],
                },
                status=status.HTTP_200_OK,
            )

        enabled_features = ["download_fbx", "plugin_api"]
        if feature and feature not in enabled_features:
            return Response(
                {
                    "valid": False,
                    "message": f"feature '{feature}' is not available",
                    "error_code": "FEATURE_NOT_AVAILABLE",
                    "features": enabled_features,
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                "valid": True,
                "message": "license is valid",
                "expires_at": profile.subscription_end_date.isoformat() if profile.subscription_end_date else None,
                "error_code": None,
                "features": enabled_features,
            },
            status=status.HTTP_200_OK,
        )


class PluginOfflineActivationView(APIView):
    """
    Офлайн-активация (окно «код запроса» → «код активации» в плагине).

    POST /api/plugin/offline-activation/
    Body: { "request_code": "<64 hex>", "license_hash": "<64 hex>" }
    Поле license_hash — тот же хеш подписки, что в профиле на сайте.

    Режим вычисления задаётся PLUGIN_OFFLINE_ACTIVATION_MODE (см. settings).
    Значение multi возвращает все варианты — по очереди пробуют в поле «Код активации».
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        request_code = (request.data.get('request_code') or '').strip()
        license_raw = (request.data.get('license_hash') or request.data.get('license_key') or '').strip()

        if not REQUEST_CODE_RE.match(request_code):
            return Response(
                {
                    'valid': False,
                    'error': 'request_code must be 64 hexadecimal characters',
                    'error_code': 'REQUEST_CODE_INVALID',
                },
                status=status.HTTP_200_OK,
            )
        if not LICENSE_INPUT_RE.match(license_raw):
            return Response(
                {
                    'valid': False,
                    'error': 'license_hash must be 64 hexadecimal characters (ключ из профиля)',
                    'error_code': 'LICENSE_INVALID_FORMAT',
                },
                status=status.HTTP_200_OK,
            )

        license_hash = license_raw.lower()
        profile = resolve_profile_by_license_value(license_hash)
        if not profile:
            return Response(
                {
                    'valid': False,
                    'error': 'Лицензия не найдена',
                    'error_code': 'LICENSE_UNKNOWN',
                },
                status=status.HTTP_200_OK,
            )
        if not profile.is_subscription_active():
            return Response(
                {
                    'valid': False,
                    'error': 'Подписка не активна или истекла',
                    'error_code': 'SUBSCRIPTION_INACTIVE',
                },
                status=status.HTTP_200_OK,
            )

        mode_setting = (getattr(settings, 'PLUGIN_OFFLINE_ACTIVATION_MODE', None) or 'sha256_rl').strip().lower()

        if mode_setting == 'multi':
            variants = compute_offline_activation_variants(request_code, license_hash)
            return Response(
                {
                    'valid': True,
                    'mode': 'multi',
                    'activation_codes': variants,
                    'hint': 'Вставьте в плагин по очереди значения из activation_codes. '
                    'Когда одно подойдёт — на сервере задайте PLUGIN_OFFLINE_ACTIVATION_MODE '
                    'равным имени этого ключа.',
                },
                status=status.HTTP_200_OK,
            )

        try:
            code, used_mode = single_offline_activation_code(request_code, license_hash)
        except ValueError as exc:
            return Response(
                {
                    'valid': False,
                    'error': str(exc),
                    'error_code': 'SERVER_CONFIG',
                },
                status=status.HTTP_200_OK,
            )

        return Response(
            {
                'valid': True,
                'activation_code': code,
                'mode': used_mode,
            },
            status=status.HTTP_200_OK,
        )


class PluginProductListView(APIView):
    """
    GET /api/plugin/products/
    Header: X-License-Hash
    Список товаров с GLB/RFA/IFC для выбора в плагине.
    """
    permission_classes = []
    authentication_classes = []

    @license_required
    def get(self, request):
        products = Product.objects.filter(is_active=True).order_by('-id')[:500]
        items = []
        for p in products:
            assets = list(p.get_3d_model_assets())

            def _urls_rfa():
                mr = (p.model_rfa or '').strip()
                return mr.lower().split('?')[0].endswith('.rfa') if mr else False

            def _urls_ifc():
                mi = getattr(p, 'model_ifc', '') or ''
                if mi.strip():
                    return mi.lower().split('?')[0].endswith('.ifc')
                mr = (p.model_rfa or '').strip()
                return mr.lower().split('?')[0].endswith('.ifc') if mr else False

            has_glb = bool(p.model_glb or any(
                a.file and a.file.name.lower().endswith(('.glb', '.gltf'))
                for a in assets
            ))
            has_rfa = bool(_urls_rfa() or any(
                a.file and a.file.name.lower().split('?')[0].endswith('.rfa')
                for a in assets
            ))
            has_ifc = bool(_urls_ifc() or any(
                a.file and a.file.name.lower().split('?')[0].endswith('.ifc')
                for a in assets
            ))
            if has_glb and has_rfa and has_ifc:
                items.append({
                    "id": p.id,
                    "title": p.title,
                    "article": p.article or "",
                    "has_glb": has_glb,
                    "has_rfa": has_rfa,
                    "has_ifc": has_ifc,
                })
        return Response({"products": items}, status=status.HTTP_200_OK)


class PluginDownloadView(APIView):
    """
    POST /api/plugin/download/
    Header: X-License-Hash
    Body: { "product_id": 123, "format": "glb" }  // format: "glb", "rfa" или "ifc"
    Возвращает url для скачивания. Лимиты как на сайте.
    """
    permission_classes = []
    authentication_classes = []

    @license_required
    def post(self, request):
        profile = request.plugin_profile
        product_id = request.data.get('product_id')
        fmt = request.data.get('format', 'glb')

        if not product_id:
            return Response(
                {"error": "product_id обязателен"},
                status=status.HTTP_400_BAD_REQUEST
            )

        fmt = fmt.lower().strip()
        if fmt not in ('glb', 'rfa', 'ifc'):
            return Response(
                {"error": "format должен быть glb, rfa или ifc"},
                status=status.HTTP_400_BAD_REQUEST
            )
        fmt_ext = f'.{fmt}'

        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Товар не найден"},
                status=status.HTTP_404_NOT_FOUND
            )

        file_url = resolve_product_file_url(product, fmt_ext, request)
        if not file_url:
            return Response(
                {"error": f"Файл {fmt.upper()} не найден для этого товара"},
                status=status.HTTP_404_NOT_FOUND
            )

        user = profile.user
        downloads_count = Download.objects.filter(user=user).values('product').distinct().count()

        if not profile.can_download(downloads_count):
            limit = profile.get_download_limit()
            sub_name = dict(UserProfile.SUBSCRIPTION_CHOICES).get(profile.subscription_type, 'Пробная')
            return Response(
                {
                    "error": f"Достигнут лимит скачиваний для подписки '{sub_name}'. "
                            f"Лимит: {limit}. Обновите подписку на сайте."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        safe_title = (product.article or str(product.id)) + "_" + "".join(
            c for c in product.title[:40] if c.isalnum() or c in ' _-'
        ).strip()
        suggested_filename = f"{safe_title}{fmt_ext}"
        connection = build_plugin_connection_payload(profile)
        local_candidate = build_local_file_candidate(
            connection.get("offline_models_path", ""),
            suggested_filename,
        )

        def _download_payload(download_id, remaining=None, warning=None):
            data = {
                "url": file_url,
                "download_id": download_id,
                "suggested_filename": suggested_filename,
                "offline_models_path": connection.get("offline_models_path", ""),
                "local_file_candidate": local_candidate,
                "file_resolution": connection.get("file_resolution", "local_first"),
                "storage_backend": connection.get("storage_backend", "local_first"),
            }
            if remaining is not None:
                data["remaining_downloads"] = remaining
            if warning:
                data["warning"] = warning
            return data

        existing = Download.objects.filter(user=user, product=product).first()
        if existing:
            return Response(
                _download_payload(
                    existing.id,
                    warning="Этот товар уже был скачан ранее",
                ),
                status=status.HTTP_200_OK,
            )

        download = Download.objects.create(user=user, product=product)
        limit = profile.get_download_limit()
        remaining = None
        if limit is not None:
            new_count = Download.objects.filter(user=user).values('product').distinct().count()
            remaining = max(0, limit - new_count)

        return Response(
            _download_payload(download.id, remaining=remaining),
            status=status.HTTP_200_OK,
        )


class PluginAssetDirectView(APIView):
    """
    GET /api/assets/{fileName}.{ext}
    Совместимость с fbx_receiver: прямой GET с X-License-Hash.
    fileName: артикул (IMR-980756ORG), product_id (2602) или asset_id (Пуф1586_QOVNVbx).
    ext: glb, rfa, ifc, rvt (rvt → rfa).
    Редирект на файл.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request, file_path):
        profile = get_profile_from_request(request)
        if not profile:
            return Response(
                {"error": "Неверный или отсутствующий ключ лицензии"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        if not profile.is_subscription_active():
            return Response(
                {"error": "Подписка не активна или истекла"},
                status=status.HTTP_403_FORBIDDEN
            )

        parts = file_path.rsplit('.', 1)
        if len(parts) != 2:
            return Response({"error": "Формат: имя.расширение (glb, rfa, ifc, rvt)"}, status=status.HTTP_400_BAD_REQUEST)
        file_base, ext = parts

        product, file_url = resolve_file_by_name(file_base, ext, request)
        if not file_url:
            return Response(
                {"error": f"Файл не найден: {file_path}"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Проверка лимитов (если есть product)
        if product:
            user = profile.user
            downloads_count = Download.objects.filter(user=user).values('product').distinct().count()
            if not profile.can_download(downloads_count):
                limit = profile.get_download_limit()
                sub_name = dict(UserProfile.SUBSCRIPTION_CHOICES).get(profile.subscription_type, 'Пробная')
                return Response(
                    {"error": f"Достигнут лимит скачиваний ({sub_name})"},
                    status=status.HTTP_403_FORBIDDEN
                )
            Download.objects.get_or_create(user=user, product=product)

        return HttpResponseRedirect(file_url, status=302)


class PluginResendActivationEmailView(APIView):
    """
    POST /api/plugin/resend-activation-email/
    JWT — повторно отправить письмо с ссылкой активации плагина.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile:
            from apps.users.models import UserProfile
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if profile.subscription_type not in ("basic", "pro", "premium"):
            return Response(
                {"error": "Плагин доступен на платных тарифах"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not profile.is_subscription_active():
            return Response(
                {"error": "Подписка не активна"},
                status=status.HTTP_403_FORBIDDEN,
            )
        sent = send_plugin_activation_email(profile, force=True)
        if not sent:
            return Response(
                {"error": "Не удалось отправить письмо. Проверьте email в профиле."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        latest = profile.plugin_activation_tokens.filter(revoked=False).order_by('-created_at').first()
        payload = activation_payload(profile, latest, mark_used=False)
        return Response(
            {
                "sent": True,
                "email": request.user.email,
                **payload,
            },
            status=status.HTTP_200_OK,
        )


class MobileAppInfoView(APIView):
    """GET /api/mobile/app-info/ — ссылки на Android APK и iOS (App Store / TestFlight)."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        apk_url = (getattr(settings, 'MOBILE_APK_DOWNLOAD_URL', None) or '').strip()
        ios_url = (getattr(settings, 'MOBILE_IOS_APP_STORE_URL', None) or '').strip()
        if not ios_url:
            ios_url = (getattr(settings, 'MOBILE_IOS_TESTFLIGHT_URL', None) or '').strip()
        ios_format = 'testflight' if 'testflight.apple.com' in ios_url.lower() else 'app_store'
        return Response(
            {
                "app_name": "VizHub AR",
                "android": {
                    "download_url": apk_url,
                    "available": bool(apk_url),
                    "format": "apk",
                    "min_version": 26,
                },
                "ios": {
                    "download_url": ios_url,
                    "available": bool(ios_url),
                    "format": ios_format if ios_url else "",
                    "min_version": "15.0",
                },
                # обратная совместимость
                "platform": "android",
                "format": "apk",
                "download_url": apk_url,
                "available": bool(apk_url),
                "min_android_version": 26,
            },
            status=status.HTTP_200_OK,
        )
