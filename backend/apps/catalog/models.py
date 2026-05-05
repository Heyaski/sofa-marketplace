from django.db import models
from django.db.models import Q, Case, When, IntegerField


class FileAsset(models.Model):
    """Модель для хранения файлов (изображения и 3D модели) с уникальным ID"""
    ASSET_TYPE_CHOICES = [
        ('image', 'Изображение'),
        ('3d_model', '3D Модель'),
    ]
    
    asset_id = models.CharField(max_length=50, verbose_name="ID файла", help_text="Уникальный идентификатор для ссылки в Excel")
    file_type = models.CharField(max_length=20, choices=ASSET_TYPE_CHOICES, verbose_name="Тип файла")
    file = models.FileField(upload_to="assets/", verbose_name="Файл")
    description = models.CharField(max_length=255, blank=True, verbose_name="Описание")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата загрузки")
    
    class Meta:
        verbose_name = "Файловый ресурс"
        verbose_name_plural = "Файловые ресурсы"
        ordering = ['-created_at']
        # Составная уникальность: один asset_id может быть для image и для 3d_model
        constraints = [
            models.UniqueConstraint(fields=['asset_id', 'file_type'], name='unique_asset_id_per_type')
        ]
    
    def __str__(self):
        return f"{self.asset_id} ({self.get_file_type_display()})"


class Category(models.Model):
    name = models.CharField(max_length=120, verbose_name="Название")
    slug = models.SlugField(unique=True, verbose_name="URL")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, verbose_name="Родительская категория")
    image = models.ImageField(upload_to="categories/", blank=True, null=True, verbose_name="Изображение")
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок", db_index=True)
    unlock_day = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="День открытия (Trial)",
        help_text="В день Trial: 0 — сразу, 4 — на 4-й день, 8 — на 8-й, 12 — на 12-й. Для обычных тарифов — 0."
    )

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"
        ordering = ["order", "id"]

    def __str__(self):
        return self.name


class Product(models.Model):
    AVAILABILITY_CHOICES = [
        ('in_stock', 'В наличии'),
        ('on_order', 'Под заказ'),
        ('out_of_stock', 'Нет в наличии'),
    ]
    
    title = models.CharField(max_length=255, verbose_name="Название")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, verbose_name="Категория")
    subcategory = models.CharField(max_length=120, blank=True, verbose_name="Подкатегория")
    description = models.TextField(blank=True, verbose_name="Описание")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Цена")
    
    # Характеристики
    article = models.CharField(max_length=100, blank=True, verbose_name="Артикул", db_index=True)
    material = models.CharField(max_length=120, blank=True, verbose_name="Материал")
    style = models.CharField(max_length=120, blank=True, verbose_name="Стиль")
    color = models.CharField(max_length=60, blank=True, verbose_name="Цвет")
    color_rgb = models.CharField(max_length=50, blank=True, verbose_name="Цвет RGB", help_text="RGB цвет в формате R,G,B (например: 255,128,64)")
    brand = models.CharField(max_length=120, blank=True, verbose_name="Бренд")
    country = models.CharField(max_length=120, blank=True, verbose_name="Страна")
    
    # Размеры (в см/мм)
    width = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, verbose_name="Ширина")
    height = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, verbose_name="Высота")
    depth = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True, verbose_name="Глубина")
    weight = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, verbose_name="Вес (кг)")
    
    # Наличие
    availability = models.CharField(max_length=20, choices=AVAILABILITY_CHOICES, default='in_stock', verbose_name="Наличие")
    
    is_active = models.BooleanField(default=True, verbose_name="Активен")
    is_trending = models.BooleanField(default=False, verbose_name="В тренде")
    
    # 🖼️ Основное изображение (для обратной совместимости)
    image = models.ImageField(upload_to="products/", blank=True, null=True, verbose_name="Основное фото")
    
    # 📦 URL фотографий (из Excel)
    photo_url = models.URLField(max_length=500, blank=True, verbose_name="URL фото")
    
    # 📦 Связь с файловыми ресурсами через ID (для импорта из Excel)
    image_asset_ids = models.CharField(max_length=500, blank=True, verbose_name="ID изображений", help_text="ID изображений через запятую (например: img_001,img_002)")
    model_3d_asset_ids = models.CharField(max_length=500, blank=True, verbose_name="ID 3D моделей", help_text="ID 3D моделей через запятую (например: model_001,model_002)")
    
    # 📦 Файлы 3D моделей (URL или пути из Excel)
    model_fbx = models.CharField(max_length=500, blank=True, verbose_name="FBX файл")
    model_glb = models.CharField(max_length=500, blank=True, verbose_name="GLB файл")
    model_rfa = models.CharField(max_length=500, blank=True, verbose_name="RFA файл")
    model_ifc = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="IFC файл",
        help_text="Отдельно от .rfa: только IFC для просмотра и выдачи в этом формате",
    )
    model_rfa_glb_preview = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="GLB-превью для RFA",
        help_text="Автоматически создается конвертацией RFA -> GLB",
    )
    model_rfa_convert_status = models.CharField(
        max_length=20,
        default="idle",
        verbose_name="Статус конвертации RFA",
        help_text="idle, queued, processing, ready, failed",
    )
    model_rfa_convert_error = models.TextField(
        blank=True,
        verbose_name="Ошибка конвертации RFA",
    )
    model_usdz = models.CharField(max_length=500, blank=True, verbose_name="USDZ файл")
    model_ar_glb = models.CharField(max_length=500, blank=True, verbose_name="AR-GLB файл")
    
    # Поля для Коммерческого предложения (КП)
    shop_url = models.URLField(max_length=500, blank=True, verbose_name="Ссылка на магазин", help_text="URL магазина/поставщика для КП")
    cp_notes = models.TextField(blank=True, verbose_name="Примечание для КП", help_text="Дополнительная информация для коммерческого предложения (производитель, коллекция и т.д.)")

    class Meta:
        verbose_name = "Товар"
        verbose_name_plural = "Товары"
        ordering = ['-id']
    
    def __str__(self):
        return self.title

    def _get_assets_by_article_fallback(self, file_type: str):
        """
        Более точный fallback по артикулу:
        - точное совпадение asset_id == article
        - article + разделитель (_ или -), чтобы не цеплять чужие префиксы
        """
        article = (self.article or '').strip()
        if not article:
            return FileAsset.objects.none()
        from django.db.models import Q
        return FileAsset.objects.filter(
            Q(asset_id__iexact=article)
            | Q(asset_id__istartswith=f"{article}_")
            | Q(asset_id__istartswith=f"{article}-"),
            file_type=file_type
        ).order_by('asset_id')
    
    def get_image_assets(self):
        """Получить все изображения по ID, с fallback по артикулу."""
        if not self.image_asset_ids:
            return self._get_assets_by_article_fallback('image')
        ids = [id.strip() for id in self.image_asset_ids.split(',') if id.strip()]
        if not ids:
            return self._get_assets_by_article_fallback('image')
        qs = FileAsset.objects.filter(asset_id__in=ids, file_type='image')
        if qs.exists():
            return qs
        return self._get_assets_by_article_fallback('image')
    
    def get_3d_model_assets(self):
        """3D-модели FileAsset: сначала model_3d_asset_ids, иначе — привязка по артикулу (как у изображений)."""
        raw = (self.model_3d_asset_ids or "").strip()
        if not raw:
            return self._get_assets_by_article_fallback('3d_model')
        ids = [i.strip() for i in raw.split(',') if i.strip()]
        if not ids:
            return self._get_assets_by_article_fallback('3d_model')
        # Собираем все варианты для поиска: точный id + вариант с пробелом (ДиванП7682 -> Диван П7682)
        import re
        ordered_keys = []
        for aid in ids:
            ordered_keys.append(aid)
            variant = re.sub(r'([а-яёa-z])([А-ЯЁA-Z])', r'\1 \2', aid)
            if variant != aid:
                ordered_keys.append(variant)

        # Строгое и предсказуемое сопоставление:
        # 1) exact по каждому id (в порядке из model_3d_asset_ids),
        # 2) затем префиксы с "_" / "-" (тоже в том же порядке).
        exact_q = Q()
        prefixed_q = Q()
        for key in ordered_keys:
            exact_q |= Q(asset_id__iexact=key)
            prefixed_q |= Q(asset_id__istartswith=f"{key}_") | Q(asset_id__istartswith=f"{key}-")

        exact_assets = list(
            FileAsset.objects.filter(file_type='3d_model').filter(exact_q).order_by('asset_id')
        )
        prefixed_assets = list(
            FileAsset.objects.filter(file_type='3d_model').filter(prefixed_q).order_by('asset_id')
        )

        if exact_assets or prefixed_assets:
            # Сохраняем стабильный порядок: сначала ключи из model_3d_asset_ids, затем алфавит внутри группы.
            rank_map = {k.lower(): idx for idx, k in enumerate(ordered_keys)}

            def _asset_rank(asset):
                asset_id_lower = (asset.asset_id or '').lower()
                best = len(rank_map) + 10
                for k, idx in rank_map.items():
                    if asset_id_lower == k or asset_id_lower.startswith(f"{k}_") or asset_id_lower.startswith(f"{k}-"):
                        best = min(best, idx)
                return (best, asset_id_lower)

            combined_pks = []
            seen = set()
            for asset in sorted(exact_assets + prefixed_assets, key=_asset_rank):
                if asset.pk in seen:
                    continue
                seen.add(asset.pk)
                combined_pks.append(asset.pk)

            def _is_browser_3d_asset(asset) -> bool:
                name = (getattr(asset.file, "name", "") or "").lower()
                return name.endswith((".glb", ".gltf", ".usdz"))

            base_len = len(combined_pks)
            order_clauses = [When(pk=pk, then=pos) for pos, pk in enumerate(combined_pks)]
            qs = FileAsset.objects.filter(pk__in=combined_pks).order_by(
                Case(*order_clauses, default=base_len, output_field=IntegerField())
            )
            # В model_3d_asset_ids часто только RFA/IFC; GLB на S3 лежит отдельным FileAsset с asset_id = артикул.
            # Без этого get_3d_model_assets() не видит GLB → API/бэкфилл думают, что файла нет.
            row0 = list(qs)
            if not any(_is_browser_3d_asset(a) for a in row0):
                article = (self.article or "").strip()
                if article:
                    known = set(combined_pks)
                    for a in self._get_assets_by_article_fallback("3d_model"):
                        if a.pk in known:
                            continue
                        if not _is_browser_3d_asset(a):
                            continue
                        combined_pks.append(a.pk)
                        known.add(a.pk)
            if len(combined_pks) > base_len:
                order_clauses = [When(pk=pk, then=pos) for pos, pk in enumerate(combined_pks)]
                return FileAsset.objects.filter(pk__in=combined_pks).order_by(
                    Case(*order_clauses, default=len(combined_pks), output_field=IntegerField())
                )
            return qs

        return self._get_assets_by_article_fallback('3d_model')
    
    def get_glb_url(self):
        """Получить URL GLB модели (приоритет: model_glb, затем FileAsset)"""
        if self.model_glb:
            return self.model_glb
        # Проверяем FileAsset
        assets = self.get_3d_model_assets()
        for asset in assets:
            if asset.file and asset.file.url.lower().endswith('.glb'):
                return asset.file.url
        return None


class ProductImage(models.Model):
    """Модель для хранения нескольких изображений товара"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images', verbose_name="Товар")
    image = models.ImageField(upload_to="products/", blank=False, null=False, verbose_name="Изображение")
    order = models.PositiveIntegerField(default=0, help_text="Порядок отображения изображения", verbose_name="Порядок")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания")

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = "Изображение товара"
        verbose_name_plural = "Изображения товаров"

    def __str__(self):
        return f"Изображение {self.order + 1} для {self.product.title}"
