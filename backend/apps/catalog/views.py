import colorsys
import hashlib
import json
import logging
import operator
import re
from functools import reduce

from django.core.cache import cache
from django.db import connection, models
from django.http import HttpResponse
from django.db.models.expressions import RawSQL
from django.db.models import Prefetch, Q
from django.db.models.functions import Concat
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response

from .catalog_glb_q import catalog_has_glb_q
from .catalog_visibility import q_catalog_visible_2d, q_catalog_visible_3d, refresh_product_visibility_flags
from .product_model_files import q_product_has_fbx
from .glb_2d_preview import _exclude_ephemeral_url_field_q
from .models import Category, FileAsset, Product, ProductImage
from .serializers import (
    CategoryLiteSerializer,
    CategorySerializer,
    ProductCatalog3DSerializer,
    ProductCatalogLiteSerializer,
    ProductSerializer,
)

logger = logging.getLogger(__name__)


def _rgb_to_scale(hue_deg: float, s: float, v: float) -> float:
    """
    Переводит цвет (HSV) в позицию на единой шкале 0–460:
      0– 25  Чёрный   (V < 0.20)
     25– 50  Серый    (S < 0.10, 0.20 ≤ V ≤ 0.67)
     50– 75  Белый    (S < 0.10, V > 0.67)
     75–100  Бежевый  (тёплый, слабонасыщенный)
    100–460  Радуга   (хроматические, S ≥ 0.10)
    """
    if v < 0.20:
        return (v / 0.20) * 25.0
    if s < 0.10 and v <= 0.67:
        return 25.0 + ((v - 0.20) / 0.47) * 25.0
    if s < 0.10 and v > 0.67:
        return 50.0 + ((v - 0.67) / 0.33) * 25.0
    if 15 <= hue_deg <= 55 and 0.10 <= s <= 0.40 and v > 0.60:
        return 75.0 + ((hue_deg - 15.0) / 40.0) * 25.0
    return 100.0 + hue_deg


class IsCatalogEditor(BasePermission):
    """Только суперпользователь может редактировать и удалять товары"""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_superuser', False)
        )


def catalog_stale_cdn_only_q() -> models.Q:
    """
    Товар попал в старый 3D-список только из-за протухшего CDN в model_glb,
    без FileAsset/стабильного GLB на S3.
    """
    blocked = models.Q()
    for fragment in (
        "auth_key=",
        "zaohaowu",
        "zaonaowu",
        "hitem3dstatic",
        "volcengine.com",
        "volccdn.com",
    ):
        blocked |= models.Q(model_glb__icontains=fragment)
    has_ephemeral_model_glb = (
        (
            models.Q(model_glb__startswith="http://")
            | models.Q(model_glb__startswith="https://")
        )
        & ~models.Q(model_glb="")
        & blocked
    )
    return has_ephemeral_model_glb & ~catalog_has_glb_q()


def catalog_has_2d_photo_q() -> models.Q:
    """
    Товар с реальным фото для 2D-витрины (как product_lacks_catalog_2d).
    Не использовать image_asset_ids из Excel — там ID без файла у ~22k товаров.
    """
    has_productimage_q = models.Exists(
        ProductImage.objects.filter(product_id=models.OuterRef("pk"))
    )
    has_main_image_q = models.Q(image__isnull=False) & ~models.Q(image="")
    has_http_photo_q = (
        models.Q(photo_url__startswith="http://")
        | models.Q(photo_url__startswith="https://")
    )
    return has_main_image_q | has_http_photo_q | has_productimage_q


def build_catalog_list_3d_assets_for_products(products: list[Product]) -> dict[int, list[FileAsset]]:
    """
    Один запрос FileAsset на страницу списка вместо N вызовов get_3d_model_assets()
    (иначе таймауты при model_files=bundle и сотнях URL/presign на страницу).
    """

    def add_article_keys(parts: list[Q], raw_key: str) -> None:
        k = (raw_key or "").strip()
        if not k:
            return
        variants = {k, re.sub(r"([а-яёa-z])([А-ЯЁA-Z])", r"\1 \2", k)}
        for kv in variants:
            kv = kv.strip()
            if not kv:
                continue
            parts.append(
                Q(asset_id__iexact=kv)
                | Q(asset_id__istartswith=f"{kv}_")
                | Q(asset_id__istartswith=f"{kv}-")
            )

    def asset_belongs_to_product(asset: FileAsset, product: Product) -> bool:
        aid = (asset.asset_id or "").lower()
        art = (product.article or "").strip().lower()
        if art and (
            aid == art or aid.startswith(f"{art}_") or aid.startswith(f"{art}-")
        ):
            return True
        raw = (product.model_3d_asset_ids or "").strip()
        for part in raw.split(","):
            k = part.strip().lower()
            if not k:
                continue
            variants = {
                k,
                re.sub(r"([а-яёa-z])([А-ЯЁA-Z])", r"\1 \2", part.strip()).lower(),
            }
            for kv in variants:
                if not kv:
                    continue
                if aid == kv or aid.startswith(f"{kv}_") or aid.startswith(f"{kv}-"):
                    return True
        return False

    if not products:
        return {}

    out: dict[int, list[FileAsset]] = {p.id: [] for p in products}
    or_parts: list[Q] = []

    for p in products:
        art = (p.article or "").strip()
        if art:
            add_article_keys(or_parts, art)
        raw = (p.model_3d_asset_ids or "").strip()
        for chunk in raw.split(","):
            add_article_keys(or_parts, chunk.strip())
        # Часто GLB в FileAsset по коду из названия (Пуф1504), а article пустой
        title_key = re.sub(r"\s+", "", (p.title or ""))[:80]
        m = re.match(r"^([A-Za-zА-Яа-яЁё]+\d+)", title_key)
        if m:
            add_article_keys(or_parts, m.group(1))

    if not or_parts:
        return out

    glb_q = (
        Q(file__iendswith=".glb")
        | Q(file__iendswith=".gltf")
        | Q(file__iendswith=".usdz")
        | Q(file__iendswith=".fbx")
    )
    base_qs = FileAsset.objects.filter(file_type="3d_model").filter(glb_q)

    # Один гигантский Q из сотен кусков даёт глубокое дерево и может ронять компиляцию SQL / стек.
    q_chunk_size = 24
    assets_by_pk: dict[int, FileAsset] = {}
    for i in range(0, len(or_parts), q_chunk_size):
        chunk = or_parts[i : i + q_chunk_size]
        sub_q = reduce(operator.or_, chunk)
        for row in base_qs.filter(sub_q).iterator(chunk_size=256):
            assets_by_pk[row.pk] = row
    assets = sorted(
        assets_by_pk.values(),
        key=lambda a: ((a.asset_id or "").lower(), a.pk),
    )

    for p in products:
        matched = [a for a in assets if asset_belongs_to_product(a, p)]
        seen: set[int] = set()
        uniq: list[FileAsset] = []
        for a in matched:
            if a.pk in seen:
                continue
            seen.add(a.pk)
            uniq.append(a)
        out[p.id] = uniq[:16]

    return out


class ProductPagination(PageNumberPagination):
    """Пагинация для товаров"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000  # Увеличиваем максимальный размер страницы для загрузки всех товаров


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True)  # Показываем только активные товары
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]  # По умолчанию; для update/destroy — IsCatalogEditor
    pagination_class = ProductPagination

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy', 'upload_model'):
            return [IsAuthenticated(), IsCatalogEditor()]
        return [AllowAny()]

    def _catalog_has_narrowing_filters(self) -> bool:
        req = self.request
        skip_keys = {'color_hue', 'page', 'page_size', 'ordering', 'format', 'list_mode'}
        for key, val in req.query_params.items():
            if key in skip_keys:
                continue
            if val is not None and str(val).strip() != '':
                return True
        return False

    def get_serializer_class(self):
        """Список: лёгкий 2D или лёгкий 3D; полный ProductSerializer только для карточки товара."""
        if self.action == 'list':
            list_mode = (self.request.query_params.get('list_mode') or '').strip().lower()
            if list_mode in ('3d', 'ar'):
                return ProductCatalog3DSerializer
            mf = (self.request.query_params.get('model_files') or '').strip().lower()
            if not mf:
                return ProductCatalogLiteSerializer
            return ProductCatalog3DSerializer
        return ProductSerializer

    def get_serializer_context(self):
        """Добавляем request и action в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        context['view_action'] = self.action
        context['catalog_list_3d_by_product_id'] = getattr(
            self.request, '_catalog_list_3d_by_product_id', None
        )
        return context

    def paginate_queryset(self, queryset):
        """Для list + model_files один batched-запрос FileAsset на страницу (без N+1)."""
        page = super().paginate_queryset(queryset)
        self.request._catalog_list_3d_by_product_id = None
        if page is not None and self.action == 'list':
            list_mode = (self.request.query_params.get('list_mode') or '').strip().lower()
            mf = (self.request.query_params.get('model_files') or '').strip().lower()
            if list_mode == '3d' or list_mode == 'ar' or mf:
                try:
                    self.request._catalog_list_3d_by_product_id = (
                        build_catalog_list_3d_assets_for_products(list(page))
                    )
                except Exception:
                    logger.exception('catalog list 3d batch prefetch failed')
                    self.request._catalog_list_3d_by_product_id = {}
        return page

    def get_queryset(self):
        """
        Переопределяем queryset для поддержки фильтрации по категориям с учетом подкатегорий
        и множественного выбора для material, style, color, brand
        """
        queryset = Product.objects.filter(is_active=True)
        # Сначала категория — сужаем выборку до list_mode / COUNT.
        queryset = self._filter_products_by_category(queryset)

        # Фильтрация по наличию файлов:
        # model_files=both -> только товары с изображением И реально доступной браузерной 3D-моделью
        # model_files=any  -> хотя бы один из файлов модели (GLB/3D id или RFA/IFC URL)
        # model_files=bundle (full3d/trio) -> GLB + Revit .rfa + .ifc (для витрины в режиме 3D)
        model_files = (self.request.query_params.get('model_files') or '').strip().lower()
        if not model_files:
            queryset = self._apply_catalog_common_filters(queryset)
            if self.action == 'list':
                list_mode = (self.request.query_params.get('list_mode') or '').strip().lower()
                if list_mode == '3d':
                    queryset = queryset.filter(q_catalog_visible_3d())
                elif list_mode == 'ar':
                    queryset = queryset.filter(catalog_has_glb_q() | q_product_has_fbx())
                else:
                    queryset = queryset.filter(q_catalog_visible_2d())
            return queryset

        has_glb_q = catalog_has_glb_q()
        glb_ext_q = (
            models.Q(file__iendswith='.glb')
            | models.Q(file__iendswith='.gltf')
            | models.Q(file__iendswith='.usdz')
        )
        has_model_file_q = (models.Q(model_rfa__isnull=False) & ~models.Q(model_rfa='')) | (
            models.Q(model_ifc__isnull=False) & ~models.Q(model_ifc='')
        )
        rfa_ext_q = models.Q(file__iendswith='.rfa')
        ifc_ext_q = models.Q(file__iendswith='.ifc')
        has_rfa_asset_by_model_id_q = models.Exists(
            FileAsset.objects.filter(file_type='3d_model').filter(rfa_ext_q).filter(
                models.Q(asset_id__iexact=models.OuterRef('model_3d_asset_ids'))
                | models.Q(asset_id__istartswith=Concat(models.OuterRef('model_3d_asset_ids'), models.Value('_')))
                | models.Q(asset_id__istartswith=Concat(models.OuterRef('model_3d_asset_ids'), models.Value('-')))
            )
        )
        has_ifc_asset_by_model_id_q = models.Exists(
            FileAsset.objects.filter(file_type='3d_model').filter(ifc_ext_q).filter(
                models.Q(asset_id__iexact=models.OuterRef('model_3d_asset_ids'))
                | models.Q(asset_id__istartswith=Concat(models.OuterRef('model_3d_asset_ids'), models.Value('_')))
                | models.Q(asset_id__istartswith=Concat(models.OuterRef('model_3d_asset_ids'), models.Value('-')))
            )
        )
        has_rfa_direct_q = (~models.Q(model_rfa='')) & (
            models.Q(model_rfa__iendswith='.rfa') | models.Q(model_rfa__icontains='.rfa?')
        )
        has_ifc_direct_q = (~models.Q(model_ifc='')) & (
            models.Q(model_ifc__iendswith='.ifc') | models.Q(model_ifc__icontains='.ifc?')
        )
        article_asset_prefix_q = (
            models.Q(asset_id__iexact=models.OuterRef('article'))
            | models.Q(asset_id__istartswith=Concat(models.OuterRef('article'), models.Value('_')))
            | models.Q(asset_id__istartswith=Concat(models.OuterRef('article'), models.Value('-')))
        )
        has_article_for_asset = models.Q(article__isnull=False) & ~models.Q(article='')
        has_rfa_via_article_q = has_article_for_asset & models.Exists(
            FileAsset.objects.filter(file_type='3d_model')
            .filter(rfa_ext_q)
            .filter(article_asset_prefix_q)
        )
        has_ifc_via_article_q = has_article_for_asset & models.Exists(
            FileAsset.objects.filter(file_type='3d_model')
            .filter(ifc_ext_q)
            .filter(article_asset_prefix_q)
        )
        has_rfa_q = has_rfa_direct_q | has_rfa_asset_by_model_id_q | has_rfa_via_article_q
        has_ifc_q = has_ifc_direct_q | has_ifc_asset_by_model_id_q | has_ifc_via_article_q
        if model_files == 'both':
            # Только быстрый SQL-фильтр без Python-итерации по всем товарам,
            # иначе каталог в 3D режиме может долго "висеть" на загрузке.
            queryset = queryset.filter(has_glb_q & catalog_has_2d_photo_q())
        elif model_files == 'any':
            queryset = queryset.filter(has_glb_q | has_model_file_q)
        elif model_files in ('bundle', 'full3d', 'trio'):
            # Сетка каталога 3D: нужен GLB для viewer. Тройной EXISTS (glb+rfa+ifc) на всей таблице
            # вешает list на минуты; RFA/IFC остаются на странице товара (retrieve).
            if self.action == 'list':
                queryset = queryset.filter(has_glb_q)
            else:
                queryset = queryset.filter(has_glb_q & has_rfa_q & has_ifc_q)

        return self._apply_catalog_common_filters(queryset)

    def _expanded_category_ids(self, raw_ids: list[int]) -> list[int]:
        cache_key = f"catalog:cat_expand:v2:{','.join(map(str, sorted(raw_ids)))}"
        expanded = cache.get(cache_key)
        if expanded is not None:
            return expanded
        out: set[int] = set()
        cats = Category.objects.filter(id__in=raw_ids).only("id", "parent_id")
        parent_ids = []
        for cat in cats:
            if cat.parent_id is None:
                parent_ids.append(cat.id)
                out.add(cat.id)
            else:
                out.add(cat.id)
        if parent_ids:
            out.update(
                Category.objects.filter(parent_id__in=parent_ids).values_list("id", flat=True)
            )
        result = sorted(out)
        cache.set(cache_key, result, timeout=300)
        return result

    def _filter_products_by_category(self, queryset):
        """category=1,2,3 с подкатегориями (кэш id категорий)."""
        category_param = self.request.query_params.get("category")
        if not category_param:
            return queryset
        ids = []
        for sid in str(category_param).split(","):
            try:
                n = int(sid.strip())
                if n > 0:
                    ids.append(n)
            except (ValueError, TypeError):
                continue
        if not ids:
            return queryset.none()
        cat_ids = self._expanded_category_ids(ids)
        if not cat_ids:
            return queryset.none()
        return queryset.filter(category_id__in=cat_ids)

    def _apply_catalog_common_filters(self, queryset):
        """Цвет, цена, габариты — категория уже в _filter_products_by_category."""
        # Фильтрация по цвету. Единая шкала 0–460:
        #   0– 25  Чёрный   (V < 0.20)
        #  25– 50  Серый    (S < 0.10, 0.20 ≤ V ≤ 0.67)
        #  50– 75  Белый    (S < 0.10, V > 0.67)
        #  75–100  Бежевый  (15° ≤ H ≤ 55°, 0.10 ≤ S ≤ 0.40, V > 0.60)
        # 100–460  Радуга   (Hue 0°–360°, S ≥ 0.10)
        color_hue = self.request.query_params.get('color_hue', None)
        if color_hue and color_hue.strip():
            raw = color_hue.strip()
            if '-' in raw:
                try:
                    part_min, part_max = raw.split('-', 1)
                    scale_min = max(0.0, min(460.0, float(part_min.strip())))
                    scale_max = max(0.0, min(460.0, float(part_max.strip())))
                    if scale_min > scale_max:
                        scale_min, scale_max = scale_max, scale_min

                    # Полный диапазон шкалы 0–460 — не фильтруем (иначе Python-проход по всему каталогу).
                    # На фронте (RGBRangeFilter) TOTAL=460, но в URL часто попадает верхняя граница чуть ниже
                    # (напр. color_hue=0-420) — для пользователя это «весь спектр», без этого условия сервер
                    # минутами перебирает все товары и фронт ловит timeout.
                    color_scale_total = 460.0
                    near_full_floor = color_scale_total - 42.0  # max >= 418 трактуем как «почти весь диапазон»
                    if scale_min <= 0 and scale_max >= near_full_floor:
                        pass
                    elif self.action == 'list':
                        # Фильтр по радуге на list отключён: полный scan каталога в Python = timeout API.
                        pass
                    else:
                        filtered_ids = []
                        color_qs = queryset.only('id', 'color_rgb').iterator(chunk_size=500)
                        for product in color_qs:
                            if not product.color_rgb or not str(product.color_rgb).strip():
                                filtered_ids.append(product.id)
                                continue
                            try:
                                rgb_parts = [
                                    max(0, min(255, int(p.strip())))
                                    for p in product.color_rgb.split(',')
                                ]
                                if len(rgb_parts) != 3:
                                    continue
                                r, g, b = rgb_parts
                                h, s, v = colorsys.rgb_to_hsv(
                                    r / 255.0, g / 255.0, b / 255.0
                                )
                                hue_deg = h * 360.0

                                pos = _rgb_to_scale(hue_deg, s, v)
                                if scale_min <= pos <= scale_max:
                                    filtered_ids.append(product.id)
                            except (ValueError, TypeError):
                                continue

                        if filtered_ids:
                            queryset = queryset.filter(id__in=filtered_ids)
                        else:
                            queryset = queryset.none()
                except (ValueError, TypeError):
                    pass

        # Фильтрация по множественным значениям (material, style, color; бренд исключён)
        for field in ['material', 'style', 'color']:
            value = self.request.query_params.get(field, None)
            if value:
                # Разделяем значения по запятой
                values = [v.strip() for v in value.split(',') if v.strip()]
                if values:
                    # Создаем Q объекты для каждого значения (поиск через contains или exact)
                    q_objects = models.Q()
                    for val in values:
                        q_objects |= models.Q(**{f'{field}__icontains': val})
                    queryset = queryset.filter(q_objects)
        
        # Фильтрация по цене (обрабатываем вручную, так как DjangoFilterBackend может не работать с DecimalField)
        price_gte = self.request.query_params.get('price__gte', None)
        price_lte = self.request.query_params.get('price__lte', None)
        if price_gte:
            try:
                queryset = queryset.filter(price__gte=float(price_gte))
            except (ValueError, TypeError):
                pass
        if price_lte:
            try:
                queryset = queryset.filter(price__lte=float(price_lte))
            except (ValueError, TypeError):
                pass
        
        # Фильтрация по габаритам (обрабатываем вручную)
        width_gte = self.request.query_params.get('width__gte', None)
        width_lte = self.request.query_params.get('width__lte', None)
        if width_gte:
            try:
                queryset = queryset.filter(width__gte=float(width_gte))
            except (ValueError, TypeError):
                pass
        if width_lte:
            try:
                queryset = queryset.filter(width__lte=float(width_lte))
            except (ValueError, TypeError):
                pass
        
        depth_gte = self.request.query_params.get('depth__gte', None)
        depth_lte = self.request.query_params.get('depth__lte', None)
        if depth_gte:
            try:
                queryset = queryset.filter(depth__gte=float(depth_gte))
            except (ValueError, TypeError):
                pass
        if depth_lte:
            try:
                queryset = queryset.filter(depth__lte=float(depth_lte))
            except (ValueError, TypeError):
                pass

        queryset = queryset.select_related('category', 'category__parent').prefetch_related(
            Prefetch(
                'images',
                queryset=ProductImage.objects.order_by('order', 'created_at'),
            )
        )

        return queryset

    # Фильтрация
    # material, style, color, brand обрабатываются вручную в get_queryset для поддержки множественного выбора
    # price, width, depth тоже обрабатываются вручную для корректной работы с DecimalField
    filterset_fields = {
        "is_active": ["exact"],
        "is_trending": ["exact"],
    }


    search_fields = ["title", "description", "article", "material", "style", "color"]

    ordering_fields = ["price", "title"]
    ordering = ["price"]

    def _products_list_cache_key(self, request) -> str:
        items = sorted((k.lower(), v) for k, v in request.query_params.items())
        digest = hashlib.md5(
            json.dumps(items, ensure_ascii=False, separators=(",", ":")).encode()
        ).hexdigest()
        return f"products_list:v8:{digest}"

    def list(self, request, *args, **kwargs):
        """Кэш списка 120 с — мгновенная смена категории при повторном выборе."""
        request._catalog_list_fast_urls = False
        cache_key = self._products_list_cache_key(request)
        if request.method == "GET":
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)
        response = super().list(request, *args, **kwargs)
        if response.status_code == 200 and isinstance(getattr(response, "data", None), dict):
            cache.set(cache_key, response.data, timeout=120)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Кэширование деталей товара (10 мин)."""
        pk = kwargs.get("pk")
        cache_key = f"product_detail:v6:{pk}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=600)
        return response

    def _invalidate_product_cache(self, product):
        """Инвалидация кэша при изменении товара."""
        cache.delete(f"product_detail:v2:{product.pk}")
        cache.delete(f"product_detail:v3:{product.pk}")
        cache.delete(f"product_detail:v4:{product.pk}")
        cache.delete(f"product_detail:v6:{product.pk}")
        refresh_product_visibility_flags(product, save=True)
        try:
            cache.delete_pattern("products_list*")
        except AttributeError:
            pass  # LocMemCache не поддерживает delete_pattern

    def perform_update(self, serializer):
        super().perform_update(serializer)
        self._invalidate_product_cache(serializer.instance)

    def perform_destroy(self, instance):
        self._invalidate_product_cache(instance)
        super().perform_destroy(instance)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._invalidate_product_cache(serializer.instance)

    @action(detail=True, methods=["post"], url_path="upload-model")
    def upload_model(self, request, pk=None):
        """Upload GLB, FBX, or Revit/BIM file (RFA/IFC) for a product (superuser only)."""
        import os
        from django.core.files.storage import default_storage

        product = self.get_object()
        file = request.FILES.get("file")
        model_format = request.data.get("format", "").lower().strip()

        if not file:
            return Response({"error": "Файл не загружен"}, status=400)
        if model_format not in ("glb", "fbx", "rfa", "ifc"):
            return Response({"error": "Допустимые форматы: glb, fbx, rfa, ifc"}, status=400)

        ext = os.path.splitext(file.name)[1].lower()
        allowed_exts = {
            "glb": {".glb"},
            "fbx": {".fbx"},
            "rfa": {".rfa"},
            "ifc": {".ifc"},
        }
        if ext not in allowed_exts[model_format]:
            return Response(
                {
                    "error": (
                        f"Расширение файла ({ext}) не соответствует формату "
                        f"({', '.join(sorted(allowed_exts[model_format]))})"
                    )
                },
                status=400,
            )

        dest = f"products/{product.id}/{file.name}"
        saved_path = default_storage.save(dest, file)
        saved_url = default_storage.url(saved_path)

        if model_format == "glb":
            product.model_glb = saved_url
            update_fields = ["model_glb"]
        elif model_format == "fbx":
            product.model_fbx = saved_url
            update_fields = ["model_fbx"]
        elif model_format == "rfa":
            product.model_rfa = saved_url
            update_fields = ["model_rfa"]
        else:
            product.model_ifc = saved_url
            update_fields = ["model_ifc"]
        product.save(update_fields=update_fields)

        self._invalidate_product_cache(product)

        if model_format == "glb":
            from apps.catalog.glb_to_usdz_converter import maybe_queue_glb_to_usdz

            maybe_queue_glb_to_usdz(product)

        serializer = self.get_serializer(product)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="ar-usdz", permission_classes=[AllowAny])
    def ar_usdz(self, request, pk=None):
        """
        USDZ для AR Quick Look на iPhone. Если USDZ нет — конвертируется из GLB товара.
        """
        product = self.get_object()
        from apps.catalog.glb_to_usdz_converter import (
            get_usdz_bytes_for_product,
            get_usdz_url_for_product,
            product_can_ios_ar,
        )

        if not product_can_ios_ar(product):
            return Response(
                {
                    "detail": (
                        f"Товар {product.pk}: нет GLB или конвертер не настроен "
                        "(install_blender_usd.sh, BLENDER_BIN в .env, restart sofa-backend)."
                    )
                },
                status=404,
            )

        direct_url = get_usdz_url_for_product(product)
        if direct_url:
            from django.http import HttpResponseRedirect

            return HttpResponseRedirect(direct_url)

        try:
            payload = get_usdz_bytes_for_product(product.pk)
        except Exception as e:
            logger.exception("ar-usdz failed for product %s", product.pk)
            return Response(
                {"detail": f"Не удалось подготовить AR-модель: {e}"},
                status=503,
            )
        response = HttpResponse(payload, content_type="model/vnd.usdz+zip")
        response["Content-Disposition"] = 'inline; filename="model.usdz"'
        response["Cache-Control"] = "public, max-age=1800"
        return response

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def filter_ranges(self, request):
        """
        Лёгкий endpoint для диапазонов фильтров — без загрузки полных товаров.
        Возвращает min/max и списки уникальных значений.
        """
        cache_key = "catalog_filter_ranges:v2"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        qs = Product.objects.filter(is_active=True).aggregate(
            price_min=models.Min("price"),
            price_max=models.Max("price"),
            width_min=models.Min("width"),
            width_max=models.Max("width"),
            depth_min=models.Min("depth"),
            depth_max=models.Max("depth"),
        )
        materials = set()
        styles = set()
        colors = set()
        for p in Product.objects.filter(is_active=True).values_list("material", "style", "color").iterator(chunk_size=500):
            for val, s in zip(p, (materials, styles, colors)):
                if val:
                    for part in str(val).split(","):
                        part = part.strip()
                        if part:
                            s.add(part)
        payload = {
            "price": {"min": float(qs["price_min"] or 0), "max": float(qs["price_max"] or 100000)},
            "width": {"min": float(qs["width_min"] or 0), "max": float(qs["width_max"] or 500)},
            "depth": {"min": float(qs["depth_min"] or 0), "max": float(qs["depth_max"] or 500)},
            "materials": sorted(materials),
            "styles": sorted(styles),
            "colors": sorted(colors),
        }
        cache.set(cache_key, payload, timeout=600)
        return Response(payload)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]  # Разрешаем чтение без авторизации

    def get_serializer_class(self):
        if self.action == "list":
            return CategoryLiteSerializer
        return CategorySerializer

    def get_queryset(self):
        if self.action == "list":
            return Category.objects.select_related("parent").all()
        return super().get_queryset()

    def list(self, request, *args, **kwargs):
        cache_key = "catalog_categories_list:v1"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=300)
        return response

    def get_serializer_context(self):
        """Добавляем request в контекст для правильной генерации URL изображений"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context