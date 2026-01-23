from django.contrib import admin
from django.utils.html import format_html
from django.shortcuts import render, redirect
from django.urls import path
from django.contrib import messages
from django.core.files import File
from django.core.files.base import ContentFile
from django.http import HttpResponse
from django.db.models import Q
from .models import Category, Product, ProductImage, FileAsset
import openpyxl
from decimal import Decimal
import os
from pathlib import Path
import zipfile
import tempfile
import shutil
from urllib.parse import quote


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "parent", "preview_image")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
    
    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"

    # красивый предпросмотр картинки
    def preview_image(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="60" height="60" style="object-fit:cover;border-radius:6px; box-shadow:0 0 4px rgba(0,0,0,0.15);"/>',
                obj.image.url
            )
        return "—"

    preview_image.short_description = "Изображение"


class ProductImageInline(admin.TabularInline):
    """Inline для загрузки нескольких изображений товара"""
    model = ProductImage
    extra = 1
    fields = ('image', 'order', 'preview')
    readonly_fields = ('preview',)
    verbose_name = "Изображение товара"
    verbose_name_plural = "Изображения товаров"

    def preview(self, obj):
        if obj.pk and obj.image:
            return format_html(
                '<img src="{}" width="100" height="100" style="object-fit:cover;border-radius:6px;"/>',
                obj.image.url
            )
        return "—"
    preview.short_description = "Предпросмотр"


class FileExtensionFilter(admin.SimpleListFilter):
    """Фильтр по расширению файла"""
    title = 'Расширение файла'
    parameter_name = 'file_extension'

    def lookups(self, request, model_admin):
        """Получаем все возможные расширения файлов (изображения и 3D модели)"""
        # Все поддерживаемые расширения изображений
        image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg']
        
        # Все поддерживаемые расширения 3D моделей
        model_extensions = ['.glb', '.gltf', '.fbx', '.obj', '.usdz', '.rfa', '.dae', '.3ds', '.ar-glb']
        
        # Начинаем с поддерживаемых расширений
        all_extensions = set(image_extensions + model_extensions)
        
        # Добавляем расширения из существующих файлов в базе данных
        for asset in FileAsset.objects.exclude(file='').exclude(file__isnull=True):
            if asset.file and hasattr(asset.file, 'name'):
                ext = os.path.splitext(asset.file.name)[1].lower()
                if ext:
                    all_extensions.add(ext)
        
        # Сортируем расширения
        sorted_extensions = sorted(all_extensions)
        
        # Формируем список для отображения
        return [(ext, ext.upper()) for ext in sorted_extensions]

    def queryset(self, request, queryset):
        """Фильтруем по выбранному расширению"""
        if self.value():
            return queryset.filter(file__iendswith=self.value())
        return queryset


class CategoryFilter(admin.SimpleListFilter):
    """Фильтр по категории товаров (показывает файлы, привязанные к товарам выбранной категории)"""
    title = 'Категория товара'
    parameter_name = 'product_category'

    def lookups(self, request, model_admin):
        """Получаем все категории, у которых есть товары с привязанными файлами"""
        # Находим категории, у которых есть товары с непустыми полями image_asset_ids или model_3d_asset_ids
        categories = Category.objects.filter(
            Q(product__image_asset_ids__isnull=False) & ~Q(product__image_asset_ids='')
        ).distinct() | Category.objects.filter(
            Q(product__model_3d_asset_ids__isnull=False) & ~Q(product__model_3d_asset_ids='')
        ).distinct()
        
        return [(cat.id, cat.name) for cat in categories.order_by('name')]

    def queryset(self, request, queryset):
        """Фильтруем файлы, привязанные к товарам выбранной категории"""
        if self.value():
            category_id = self.value()
            # Получаем все asset_id из товаров выбранной категории
            products = Product.objects.filter(category_id=category_id)
            
            asset_ids = set()
            for product in products:
                # Добавляем ID изображений
                if product.image_asset_ids and product.image_asset_ids.strip():
                    ids = [id.strip() for id in product.image_asset_ids.split(',') if id.strip()]
                    asset_ids.update(ids)
                
                # Добавляем ID 3D моделей
                if product.model_3d_asset_ids and product.model_3d_asset_ids.strip():
                    ids = [id.strip() for id in product.model_3d_asset_ids.split(',') if id.strip()]
                    asset_ids.update(ids)
            
            if asset_ids:
                return queryset.filter(asset_id__in=asset_ids)
            else:
                # Если нет привязанных файлов, возвращаем пустой queryset
                return queryset.none()
        return queryset


@admin.register(FileAsset)
class FileAssetAdmin(admin.ModelAdmin):
    list_display = ("asset_id", "file_type", "file", "description", "created_at", "preview")
    list_filter = ("file_type", FileExtensionFilter, CategoryFilter, "created_at")
    search_fields = ("asset_id", "description")
    ordering = ("-created_at",)
    
    class Meta:
        verbose_name = "Файловый ресурс"
        verbose_name_plural = "Файловые ресурсы"
    
    def preview(self, obj):
        if obj.file_type == 'image' and obj.file:
            return format_html(
                '<img src="{}" width="80" height="80" style="object-fit:cover;border-radius:6px;"/>',
                obj.file.url
            )
        elif obj.file_type == '3d_model':
            return format_html('<span style="color:#666;">📦 3D модель</span>')
        return "—"
    preview.short_description = "Предпросмотр"
    
    change_list_template = "admin/catalog/fileasset_changelist.html"
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-files/', self.import_files_view, name='catalog_fileasset_import'),
            path('download-template/', self.download_template_view, name='catalog_fileasset_download_template'),
            path('sync-with-products/', self.sync_files_with_products_view, name='catalog_fileasset_sync'),
        ]
        return custom_urls + urls
    
    def import_files_view(self, request):
        """Массовый импорт файлов через ZIP архив (автоматическое определение типа и ID)"""
        if request.method == "POST":
            zip_file = request.FILES.get('zip_file')
            
            if not zip_file:
                messages.error(request, "Пожалуйста, выберите ZIP архив с файлами")
                return redirect("..")
            
            try:
                # Проверяем размер ZIP файла
                zip_file.seek(0, 2)  # Перемещаемся в конец файла
                zip_size = zip_file.tell()
                zip_file.seek(0)  # Возвращаемся в начало
                
                # Создаем временную директорию для распаковки
                temp_dir = tempfile.mkdtemp()
                
                try:
                    # Для больших ZIP архивов сохраняем на диск перед распаковкой
                    # чтобы не загружать весь архив в память
                    if zip_size > 100 * 1024 * 1024:  # Если ZIP больше 100MB
                        # Сохраняем ZIP на диск
                        temp_zip_path = os.path.join(temp_dir, 'archive.zip')
                        with open(temp_zip_path, 'wb') as f:
                            # Читаем файл по частям для экономии памяти
                            for chunk in zip_file.chunks(chunk_size=10 * 1024 * 1024):  # 10MB chunks
                                f.write(chunk)
                        
                        # Распаковываем ZIP с диска
                        with zipfile.ZipFile(temp_zip_path, 'r') as zf:
                            zf.extractall(temp_dir)
                    else:
                        # Для небольших ZIP читаем напрямую из памяти
                        with zipfile.ZipFile(zip_file, 'r') as zf:
                            zf.extractall(temp_dir)
                    
                    created_count = 0
                    updated_count = 0
                    skipped_count = 0
                    products_linked_count = 0
                    errors = []
                    
                    # Расширения файлов для определения типа
                    image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg']
                    model_extensions = ['.glb', '.gltf', '.fbx', '.obj', '.usdz', '.rfa', '.dae', '.3ds']
                    
                    # Функция для извлечения базового артикула из asset_id
                    def extract_base_article(asset_id):
                        """Извлекает базовый артикул из asset_id (например: IMR-556065(1) -> IMR-556065, IMR-517626 (2) -> IMR-517626)"""
                        if not asset_id:
                            return ''
                        # Убираем пробелы в начале и конце
                        asset_id = asset_id.strip()
                        # Ищем скобку (может быть с пробелом: " (2)" или без: "(2)")
                        if '(' in asset_id:
                            # Разделяем по скобке и берем первую часть
                            base = asset_id.split('(')[0].strip()
                            return base
                        return asset_id
                    
                    # Словарь для группировки созданных FileAsset по артикулам
                    articles_files = {}  # {article: {'images': [FileAsset], 'models': [FileAsset]}}
                    
                    # Собираем все файлы из архива (включая вложенные папки)
                    for root, dirs, files in os.walk(temp_dir):
                        for filename in files:
                            # Игнорируем системные файлы
                            if filename.startswith('.') or filename == '__MACOSX':
                                continue
                            
                            try:
                                full_path = os.path.join(root, filename)
                                
                                # Определяем тип файла по расширению
                                file_ext = os.path.splitext(filename)[1].lower()
                                
                                if file_ext in image_extensions:
                                    file_type = 'image'
                                elif file_ext in model_extensions:
                                    file_type = '3d_model'
                                else:
                                    # Пропускаем файлы с неподдерживаемыми расширениями
                                    skipped_count += 1
                                    continue
                                
                                # Используем имя файла без расширения как asset_id
                                # Это работает с артикулами типа IMR-556065, IMR-556065(1) и т.д.
                                asset_id = os.path.splitext(filename)[0]
                                
                                # Определяем имя файла для сохранения
                                save_filename = filename
                                
                                # Проверяем размер файла для больших 3D моделей
                                file_size = os.path.getsize(full_path)
                                
                                # Проверяем, существует ли уже FileAsset с таким ID и типом
                                existing = FileAsset.objects.filter(
                                    asset_id=asset_id,
                                    file_type=file_type
                                ).first()
                                
                                # Для больших файлов используем прямое сохранение из файла
                                # вместо чтения всего содержимого в память
                                if file_size > 50 * 1024 * 1024:  # Если файл больше 50MB
                                    # Используем прямое сохранение из файла для экономии памяти
                                    with open(full_path, 'rb') as f:
                                        if existing:
                                            # Обновляем существующий
                                            existing.file.save(save_filename, f, save=True)
                                            file_asset = existing
                                            updated_count += 1
                                        else:
                                            # Создаем новый
                                            file_asset = FileAsset(
                                                asset_id=asset_id,
                                                file_type=file_type,
                                                description=''
                                            )
                                            file_asset.file.save(save_filename, f, save=True)
                                            created_count += 1
                                else:
                                    # Для небольших файлов читаем в память (быстрее)
                                    with open(full_path, 'rb') as f:
                                        file_content = f.read()
                                    
                                    if existing:
                                        # Обновляем существующий
                                        existing.file.save(save_filename, ContentFile(file_content), save=True)
                                        file_asset = existing
                                        updated_count += 1
                                    else:
                                        # Создаем новый
                                        file_asset = FileAsset(
                                            asset_id=asset_id,
                                            file_type=file_type,
                                            description=''
                                        )
                                        file_asset.file.save(save_filename, ContentFile(file_content), save=True)
                                        created_count += 1
                                
                                # Группируем файлы по базовому артикулу
                                base_article = extract_base_article(asset_id)
                                if base_article not in articles_files:
                                    articles_files[base_article] = {'images': [], 'models': []}
                                
                                if file_type == 'image':
                                    articles_files[base_article]['images'].append(file_asset)
                                else:
                                    articles_files[base_article]['models'].append(file_asset)
                                    
                            except Exception as e:
                                errors.append(f"Ошибка при обработке файла '{filename}': {str(e)}")
                    
                    # После создания всех FileAsset, привязываем их к существующим товарам по артикулу
                    for article, files_data in articles_files.items():
                        try:
                            # Ищем товар по артикулу (без учета регистра)
                            product = Product.objects.filter(article__iexact=article).first()
                            
                            if product:
                                # Привязываем изображения
                                if files_data['images']:
                                    # Сортируем изображения по asset_id (чтобы IMR-556065(1) был после IMR-556065)
                                    sorted_images = sorted(files_data['images'], key=lambda x: x.asset_id)
                                    
                                    image_asset_ids = [asset.asset_id for asset in sorted_images]
                                    # Объединяем с существующими ID
                                    existing_ids = product.image_asset_ids.split(',') if product.image_asset_ids else []
                                    existing_ids = [id.strip() for id in existing_ids if id.strip()]
                                    all_image_ids = list(set(existing_ids + image_asset_ids))
                                    product.image_asset_ids = ','.join(all_image_ids)
                                    
                                    # Создаем ProductImage для каждого изображения
                                    for order, asset in enumerate(sorted_images, start=0):
                                        try:
                                            # Проверяем, не существует ли уже такое изображение
                                            existing_image = product.images.filter(
                                                image__icontains=os.path.basename(asset.file.name)
                                            ).first()
                                            
                                            if not existing_image and asset.file:
                                                # Копируем файл из FileAsset в ProductImage
                                                asset.file.open('rb')
                                                file_content = asset.file.read()
                                                asset.file.close()
                                                
                                                product_image = ProductImage(
                                                    product=product,
                                                    order=order
                                                )
                                                filename = os.path.basename(asset.file.name)
                                                product_image.image.save(
                                                    filename,
                                                    ContentFile(file_content),
                                                    save=True
                                                )
                                        except Exception as img_error:
                                            errors.append(f"Ошибка при создании ProductImage для товара '{article}': {str(img_error)}")
                                
                                # Привязываем 3D модели
                                if files_data['models']:
                                    model_asset_ids = [asset.asset_id for asset in files_data['models']]
                                    # Объединяем с существующими ID
                                    existing_model_ids = product.model_3d_asset_ids.split(',') if product.model_3d_asset_ids else []
                                    existing_model_ids = [id.strip() for id in existing_model_ids if id.strip()]
                                    all_model_ids = list(set(existing_model_ids + model_asset_ids))
                                    product.model_3d_asset_ids = ','.join(all_model_ids)
                                    
                                    # Устанавливаем соответствующие поля моделей
                                    for asset in files_data['models']:
                                        try:
                                            if asset.file and hasattr(asset.file, 'url'):
                                                file_ext = os.path.splitext(asset.file.name)[1].lower()
                                                file_url = asset.file.url
                                                
                                                if file_ext == '.glb' and not product.model_glb:
                                                    product.model_glb = file_url
                                                elif file_ext == '.fbx' and not product.model_fbx:
                                                    product.model_fbx = file_url
                                                elif file_ext == '.usdz' and not product.model_usdz:
                                                    product.model_usdz = file_url
                                                elif file_ext == '.rfa' and not product.model_rfa:
                                                    product.model_rfa = file_url
                                        except Exception:
                                            pass
                                
                                # Сохраняем товар
                                product.save(update_fields=['image_asset_ids', 'model_3d_asset_ids', 'model_glb', 'model_fbx', 'model_usdz', 'model_rfa'])
                                products_linked_count += 1
                            else:
                                # Товар не найден - добавляем в ошибки для информации
                                if files_data['images'] or files_data['models']:
                                    errors.append(f"Товар с артикулом '{article}' не найден. Файлы созданы в FileAsset, но не привязаны.")
                                
                        except Exception as e:
                            errors.append(f"Ошибка при привязке файлов к товару с артикулом '{article}': {str(e)}")
                    
                    
                    # Формируем сообщение
                    success_parts = []
                    if created_count > 0:
                        success_parts.append(f"файлов создано: {created_count}")
                    if updated_count > 0:
                        success_parts.append(f"файлов обновлено: {updated_count}")
                    if products_linked_count > 0:
                        success_parts.append(f"товаров обновлено: {products_linked_count}")
                    if skipped_count > 0:
                        success_parts.append(f"файлов пропущено: {skipped_count}")
                    
                    if success_parts:
                        messages.success(
                            request, 
                            f"Импорт завершен! {', '.join(success_parts)}"
                        )
                    
                    if errors:
                        for error in errors[:10]:
                            messages.warning(request, error)
                        if len(errors) > 10:
                            messages.warning(request, f"... и еще {len(errors) - 10} ошибок")
                    
                finally:
                    # Удаляем временную директорию
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    
            except zipfile.BadZipFile:
                messages.error(request, "Некорректный ZIP файл")
            except Exception as e:
                messages.error(request, f"Ошибка при обработке: {str(e)}")
            
            return redirect("..")
        
        return render(request, "admin/catalog/import_files.html")
    
    def sync_files_with_products_view(self, request):
        """Синхронизация существующих FileAsset с товарами по артикулу"""
        if request.method == "POST":
            try:
                # Функция для извлечения базового артикула
                def extract_base_article(asset_id):
                    """Извлекает базовый артикул из asset_id"""
                    if not asset_id:
                        return ''
                    asset_id = asset_id.strip()
                    if '(' in asset_id:
                        base = asset_id.split('(')[0].strip()
                        return base
                    return asset_id
                
                # Группируем FileAsset по артикулам
                articles_files = {}
                all_file_assets = FileAsset.objects.all()
                
                for asset in all_file_assets:
                    base_article = extract_base_article(asset.asset_id)
                    if not base_article:
                        continue
                    
                    if base_article not in articles_files:
                        articles_files[base_article] = {'images': [], 'models': []}
                    
                    if asset.file_type == 'image':
                        articles_files[base_article]['images'].append(asset)
                    else:
                        articles_files[base_article]['models'].append(asset)
                
                products_linked_count = 0
                images_attached_count = 0
                errors = []
                
                # Привязываем файлы к товарам
                for article, files_data in articles_files.items():
                    try:
                        # Ищем товар по артикулу (без учета регистра)
                        # Убираем пробелы из артикула для поиска
                        article_clean = article.strip().upper()
                        product = Product.objects.filter(article__iexact=article_clean).first()
                        
                        # Если не найдено, пробуем поиск без учета пробелов в артикуле товара
                        if not product:
                            # Ищем товары, у которых артикул совпадает после удаления пробелов
                            all_products = Product.objects.all()
                            for p in all_products:
                                if p.article and p.article.strip().upper().replace(' ', '') == article_clean.replace(' ', ''):
                                    product = p
                                    break
                        
                        if product:
                            # Привязываем изображения
                            if files_data['images']:
                                sorted_images = sorted(files_data['images'], key=lambda x: x.asset_id)
                                image_asset_ids = [asset.asset_id for asset in sorted_images]
                                
                                # Объединяем с существующими ID
                                existing_ids = product.image_asset_ids.split(',') if product.image_asset_ids else []
                                existing_ids = [id.strip() for id in existing_ids if id.strip()]
                                all_image_ids = list(set(existing_ids + image_asset_ids))
                                product.image_asset_ids = ','.join(all_image_ids)
                                
                                # Создаем ProductImage для каждого изображения
                                for order, asset in enumerate(sorted_images, start=0):
                                    try:
                                        existing_image = product.images.filter(
                                            image__icontains=os.path.basename(asset.file.name)
                                        ).first()
                                        
                                        if not existing_image and asset.file:
                                            asset.file.open('rb')
                                            file_content = asset.file.read()
                                            asset.file.close()
                                            
                                            product_image = ProductImage(
                                                product=product,
                                                order=order
                                            )
                                            filename = os.path.basename(asset.file.name)
                                            product_image.image.save(
                                                filename,
                                                ContentFile(file_content),
                                                save=True
                                            )
                                            images_attached_count += 1
                                    except Exception as img_error:
                                        errors.append(f"Ошибка при создании ProductImage для товара '{article}': {str(img_error)}")
                            
                            # Привязываем 3D модели
                            if files_data['models']:
                                model_asset_ids = [asset.asset_id for asset in files_data['models']]
                                existing_model_ids = product.model_3d_asset_ids.split(',') if product.model_3d_asset_ids else []
                                existing_model_ids = [id.strip() for id in existing_model_ids if id.strip()]
                                all_model_ids = list(set(existing_model_ids + model_asset_ids))
                                product.model_3d_asset_ids = ','.join(all_model_ids)
                                
                                # Устанавливаем соответствующие поля моделей
                                for asset in files_data['models']:
                                    try:
                                        if asset.file and hasattr(asset.file, 'url'):
                                            file_ext = os.path.splitext(asset.file.name)[1].lower()
                                            file_url = asset.file.url
                                            
                                            if file_ext == '.glb' and not product.model_glb:
                                                product.model_glb = file_url
                                            elif file_ext == '.fbx' and not product.model_fbx:
                                                product.model_fbx = file_url
                                            elif file_ext == '.usdz' and not product.model_usdz:
                                                product.model_usdz = file_url
                                            elif file_ext == '.rfa' and not product.model_rfa:
                                                product.model_rfa = file_url
                                    except Exception:
                                        pass
                            
                            # Сохраняем товар
                            product.save(update_fields=['image_asset_ids', 'model_3d_asset_ids', 'model_glb', 'model_fbx', 'model_usdz', 'model_rfa'])
                            products_linked_count += 1
                            
                    except Exception as e:
                        errors.append(f"Ошибка при привязке файлов к товару с артикулом '{article}': {str(e)}")
                
                # Формируем сообщение
                success_msg = f"Синхронизация завершена! Товаров обновлено: {products_linked_count}"
                if images_attached_count > 0:
                    success_msg += f", изображений привязано: {images_attached_count}"
                
                if products_linked_count > 0 or images_attached_count > 0:
                    messages.success(request, success_msg)
                else:
                    messages.info(request, "Не найдено товаров для привязки файлов. Убедитесь, что артикулы в товарах совпадают с артикулами в именах файлов.")
                
                if errors:
                    for error in errors[:10]:
                        messages.warning(request, error)
                    if len(errors) > 10:
                        messages.warning(request, f"... и еще {len(errors) - 10} ошибок")
                        
            except Exception as e:
                messages.error(request, f"Ошибка при синхронизации: {str(e)}")
            
            return redirect("..")
        
        return render(request, "admin/catalog/sync_files.html")
    
    def download_template_view(self, request):
        """Скачать шаблон Excel файла для импорта файлов"""
        # Создаем новый Excel файл
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Файлы"
        
        # Заголовки столбцов
        headers = ['URL', 'Имя файла', 'ID файла', 'Тип файла']
        ws.append(headers)
        
        # Форматируем заголовки
        from openpyxl.styles import Font, PatternFill, Alignment
        header_fill = PatternFill(start_color="FFE0E0E0", end_color="FFE0E0E0", fill_type="solid")
        header_font = Font(bold=True, size=12)
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.value = header
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
        
        # Добавляем примеры строк с формулами
        # Пример 1: изображение
        ws.append([
            r'E:\VizHub\partial\Мягкая мебель — Диваны — Угловые диваны\photos\IMR-1382731_GRY(1).webp',
            f'=TRIM(RIGHT(SUBSTITUTE(A2,"\\",REPT(" ",200)),200))',
            f'=LEFT(B2,FIND(".",B2)-1)',
            f'=LET(f,B2,ext,LOWER(RIGHT(f,LEN(f)-FIND(".",f))),IF(OR(ext="jpg",ext="jpeg",ext="png",ext="webp"),"image",IF(OR(ext="glb",ext="fbx",ext="obj"),"3d_model","unknown")))'
        ])
        
        # Пример 2: 3D модель
        ws.append([
            r'E:\VizHub\partial\Мягкая мебель — Диваны — Угловые диваны\models\IMR-1382731.glb',
            f'=TRIM(RIGHT(SUBSTITUTE(A3,"\\",REPT(" ",200)),200))',
            f'=LEFT(B3,FIND(".",B3)-1)',
            f'=LET(f,B3,ext,LOWER(RIGHT(f,LEN(f)-FIND(".",f))),IF(OR(ext="jpg",ext="jpeg",ext="png",ext="webp"),"image",IF(OR(ext="glb",ext="fbx",ext="obj"),"3d_model","unknown")))'
        ])
        
        # Настраиваем ширину столбцов
        ws.column_dimensions['A'].width = 80
        ws.column_dimensions['B'].width = 30
        ws.column_dimensions['C'].width = 20
        ws.column_dimensions['D'].width = 30
        
        # Создаем HTTP ответ с файлом
        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        # Правильно кодируем имя файла для русских символов
        filename = 'Таблица файлов.xlsx'
        encoded_filename = quote(filename.encode('utf-8'))
        response['Content-Disposition'] = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{encoded_filename}'
        
        wb.save(response)
        return response


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "article",
        "title",
        "category",
        "price",
        "availability",
        "brand",
        "color",
        "has_3d_model",
        "is_active",
    )
    list_filter = ("category", "availability", "brand", "material", "color", "is_active", "is_trending")
    search_fields = ("title", "article", "description", "brand")
    list_editable = ("price", "is_active")
    inlines = [ProductImageInline]
    
    def has_3d_model(self, obj):
        """Проверяет наличие 3D модели"""
        if obj.model_glb or obj.model_fbx or obj.model_usdz or obj.model_3d_asset_ids:
            return format_html('<span style="color: green;">✅</span>')
        return format_html('<span style="color: #ccc;">—</span>')
    has_3d_model.short_description = "3D"
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'article', 'category', 'subcategory', 'description', 'price', 'availability')
        }),
        ('Характеристики', {
            'fields': ('material', 'style', 'color', 'brand', 'country')
        }),
        ('Размеры', {
            'fields': (('width', 'height', 'depth'), 'weight'),
            'classes': ('collapse',)
        }),
        ('Фотографии и 3D Модели', {
            'fields': (
                'photo_url', 
                'image', 
                'image_asset_ids',
                'model_glb', 
                'model_fbx', 
                'model_rfa', 
                'model_usdz', 
                'model_ar_glb', 
                'model_3d_asset_ids'
            ),
        }),
        ('Настройки', {
            'fields': ('is_active', 'is_trending')
        }),
    )
    
    change_list_template = "admin/catalog/product_changelist.html"
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-excel/', self.import_excel, name='catalog_product_import_excel'),
        ]
        return custom_urls + urls
    
    def import_excel(self, request):
        if request.method == "POST":
            excel_file = request.FILES.get('excel_file')
            zip_file = request.FILES.get('zip_file')  # Опциональный ZIP архив с изображениями
            
            if not excel_file:
                messages.error(request, "Пожалуйста, выберите Excel файл")
                return redirect("..")
            
            try:
                # Обработка ZIP архива (если загружен)
                temp_dir = None
                files_in_zip = {}
                image_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']
                
                if zip_file:
                    try:
                        temp_dir = tempfile.mkdtemp()
                        # Распаковываем ZIP
                        with zipfile.ZipFile(zip_file, 'r') as zf:
                            zf.extractall(temp_dir)
                        
                        # Собираем все файлы из архива (включая вложенные папки)
                        for root, dirs, files in os.walk(temp_dir):
                            for filename in files:
                                # Игнорируем системные файлы
                                if filename.startswith('.') or filename == '__MACOSX':
                                    continue
                                full_path = os.path.join(root, filename)
                                # Сохраняем по имени файла (без пути) в нижнем регистре для поиска
                                files_in_zip[filename.lower()] = full_path
                                # Также сохраняем с относительным путём
                                rel_path = os.path.relpath(full_path, temp_dir)
                                files_in_zip[rel_path.lower()] = full_path
                    except zipfile.BadZipFile:
                        messages.warning(request, "Некорректный ZIP файл. Импорт товаров продолжится без изображений.")
                    except Exception as e:
                        messages.warning(request, f"Ошибка при обработке ZIP архива: {str(e)}. Импорт товаров продолжится без изображений.")
                
                wb = openpyxl.load_workbook(excel_file)
                ws = wb.active
                
                # Читаем заголовки из первой строки для определения колонок
                headers = [str(cell.value).strip().lower() if cell.value else '' for cell in ws[1]]
                
                # Маппинг колонок (поддержка разных названий)
                column_mapping = {
                    'id': ['id', 'айди', 'идентификатор', 'код товара'],
                    'title': ['название', 'name', 'title', 'наименование'],
                    'availability': ['наличие', 'availability', 'налич'],
                    'width': ['ширина', 'width', 'ши'],
                    'height': ['высота', 'height', 'вы'],
                    'depth': ['глубина', 'depth', 'гл'],
                    'weight': ['вес', 'weight', 'ве'],
                    'material': ['материал', 'material', 'матер'],
                    'country': ['страна', 'country', 'стран'],
                    'brand': ['бренд', 'brand'],
                    'color': ['цвет', 'color'],
                    'article': ['артикул', 'article', 'sku', 'код'],
                    'price': ['цена', 'price'],
                    'category': ['категория', 'category', 'катег'],
                    'subcategory': ['подкатегория', 'subcategory', 'подка'],
                    'description': ['описание', 'description', 'ория'],
                    'photo_url': ['url photo', 'urlphoto', 'url_photo', 'фото', 'photo', 'image_url'],
                    'image_asset_ids': ['id изображений', 'image_asset_ids', 'image_ids', 'id изображения', 'id фото'],
                    'id_3d': ['id 3d', 'id3d', '3d id', '3d_id'],
                    'model_3d_asset_ids': ['id 3d моделей', 'model_3d_asset_ids', '3d_asset_ids', 'id модели', 'id моделей', '3d model id', '3d_model_id'],
                    'model_fbx': ['fbx', 'model_fbx'],
                    'model_glb': ['glb', 'model_glb'],
                    'model_rfa': ['rfa', 'model_rfa'],
                    'model_usdz': ['usdz', 'model_usdz'],
                    'model_ar_glb': ['ar-glb', 'ar_glb', 'arglb', 'model_ar_glb'],
                }
                
                # Находим индексы колонок
                col_indices = {}
                for field, possible_names in column_mapping.items():
                    for idx, header in enumerate(headers):
                        if any(name in header for name in possible_names):
                            col_indices[field] = idx
                            break
                
                # Если колонка ID не найдена по заголовку, используем первую колонку (индекс 0) как ID
                if 'id' not in col_indices:
                    col_indices['id'] = 0
                
                created_count = 0
                updated_count = 0
                images_attached_count = 0
                models_attached_count = 0
                errors = []
                
                def get_cell_value(row, field, default=''):
                    """Получить значение ячейки по имени поля"""
                    if field not in col_indices:
                        return default
                    idx = col_indices[field]
                    if idx < len(row) and row[idx] is not None:
                        return str(row[idx]).strip()
                    return default
                
                def get_decimal_value(row, field, default=None):
                    """Получить числовое значение"""
                    val = get_cell_value(row, field, '')
                    if not val:
                        return default
                    try:
                        # Убираем пробелы и заменяем запятую на точку
                        val = val.replace(' ', '').replace(',', '.')
                        return Decimal(val)
                    except:
                        return default
                
                def parse_availability(val):
                    """Преобразовать значение наличия"""
                    val = val.lower()
                    if 'в наличи' in val or 'наличи' in val or 'in stock' in val:
                        return 'in_stock'
                    elif 'заказ' in val or 'order' in val:
                        return 'on_order'
                    return 'in_stock'
                
                def find_files_by_article(article, files_dict, file_type='image'):
                    """Найти все файлы (изображения или 3D модели) для артикула в ZIP архиве"""
                    if not article or not files_dict:
                        return []
                    
                    article_clean = article.strip().upper()
                    found_files = []
                    
                    # Определяем расширения в зависимости от типа
                    image_exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg']
                    model_exts = ['.glb', '.gltf', '.fbx', '.obj', '.usdz', '.rfa', '.dae', '.3ds']
                    
                    if file_type == 'image':
                        allowed_extensions = image_exts
                    else:
                        allowed_extensions = model_exts
                    
                    # Ищем файлы, которые начинаются с артикула
                    for filename_lower, file_path in files_dict.items():
                        filename_upper = filename_lower.upper()
                        # Проверяем расширение файла
                        file_ext = os.path.splitext(filename_lower)[1].lower()
                        if file_ext not in allowed_extensions:
                            continue
                        
                        # Убираем расширение для сравнения
                        name_without_ext = os.path.splitext(filename_upper)[0]
                        
                        # Проверяем точное совпадение артикула или артикул с номером в скобках
                        # Например: IMR-556065.jpg или IMR-556065(1).jpg или IMR-556065(2).jpg
                        if name_without_ext == article_clean:
                            # Точное совпадение без скобок
                            found_files.append((file_path, 0))
                        elif name_without_ext.startswith(article_clean + '('):
                            # Артикул с номером в скобках: IMR-556065(1)
                            try:
                                # Извлекаем номер из скобок
                                rest = name_without_ext[len(article_clean) + 1:]  # Убираем "IMR-556065("
                                if rest.endswith(')'):
                                    number_str = rest[:-1]  # Убираем закрывающую скобку
                                    number = int(number_str)
                                    found_files.append((file_path, number))
                            except (ValueError, IndexError):
                                # Если не удалось распарсить номер, все равно добавляем
                                found_files.append((file_path, 999))
                    
                    # Сортируем по номеру в скобках (если есть)
                    found_files.sort(key=lambda x: x[1])
                    return [file_path for file_path, _ in found_files]
                
                # Пропускаем заголовок
                for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                    try:
                        title = get_cell_value(row, 'title')
                        if not title or title.strip() == '':
                            continue  # Пропускаем пустые строки
                        
                        # Получаем цену
                        price = get_decimal_value(row, 'price', Decimal('0.00'))
                        if price is None or price <= 0:
                            errors.append(f"Строка {row_num}: не указана цена или цена некорректна (цена: {price})")
                            continue
                        
                        # Получаем категорию и подкатегорию
                        category_name = get_cell_value(row, 'category', 'Без категории')
                        subcategory_name = get_cell_value(row, 'subcategory', '').strip()
                        
                        # Используем подкатегорию как основную категорию продукта (если она указана)
                        # Если подкатегории нет, используем категорию
                        if subcategory_name:
                            # Создаем подкатегорию как основную категорию (без parent)
                            # Это будет категория, которая отображается на сайте
                            category_slug = subcategory_name.lower().replace(' ', '-')
                            # Убеждаемся, что slug уникален
                            base_slug = category_slug
                            counter = 1
                            while Category.objects.filter(slug=category_slug).exists():
                                category_slug = f"{base_slug}-{counter}"
                                counter += 1
                            
                            category, _ = Category.objects.get_or_create(
                                name=subcategory_name,
                                parent=None,  # Подкатегория становится основной категорией
                                defaults={'slug': category_slug}
                            )
                        else:
                            # Если подкатегории нет, используем категорию из колонки "категория"
                            if category_name:
                                category, _ = Category.objects.get_or_create(
                                    name=category_name,
                                    parent=None,
                                    defaults={'slug': category_name.lower().replace(' ', '-')}
                                )
                            else:
                                # Если нет ни категории, ни подкатегории
                                category, _ = Category.objects.get_or_create(
                                    slug='default',
                                    parent=None,
                                    defaults={'name': 'Без категории'}
                                )
                        
                        # Получаем ID из первой колонки (если есть)
                        product_id = get_cell_value(row, 'id', '')
                        
                        # Получаем ID изображений и 3D моделей из Excel (если указаны)
                        image_asset_ids = get_cell_value(row, 'image_asset_ids', '')
                        
                        # Сначала проверяем колонку "id 3d" (приоритет), затем "ID 3D моделей"
                        id_3d = get_cell_value(row, 'id_3d', '')
                        model_3d_asset_ids = get_cell_value(row, 'model_3d_asset_ids', '')
                        
                        # Если указана колонка "id 3d", используем её значение
                        if id_3d:
                            model_3d_asset_ids = id_3d
                        
                        # Если ID продукта указан в первой колонке и поля image_asset_ids/model_3d_asset_ids 
                        # не заполнены в Excel, автоматически используем ID из первой колонки
                        if product_id:
                            if not image_asset_ids:
                                # Автоматически используем ID из первой колонки для изображений
                                image_asset_ids = product_id
                            
                            if not model_3d_asset_ids:
                                # Автоматически используем ID из первой колонки для 3D моделей
                                model_3d_asset_ids = product_id
                        
                        # Данные для создания/обновления
                        product_data = {
                            'category': category,
                            'price': price,
                            'availability': parse_availability(get_cell_value(row, 'availability', 'в наличии')),
                            'width': get_decimal_value(row, 'width'),
                            'height': get_decimal_value(row, 'height'),
                            'depth': get_decimal_value(row, 'depth'),
                            'weight': get_decimal_value(row, 'weight'),
                            'material': get_cell_value(row, 'material'),
                            'country': get_cell_value(row, 'country'),
                            'brand': get_cell_value(row, 'brand'),
                            'color': get_cell_value(row, 'color'),
                            'article': get_cell_value(row, 'article'),
                            'subcategory': get_cell_value(row, 'subcategory'),
                            'description': get_cell_value(row, 'description'),
                            'photo_url': get_cell_value(row, 'photo_url'),
                            'image_asset_ids': image_asset_ids,
                            'model_3d_asset_ids': model_3d_asset_ids,
                            'model_fbx': get_cell_value(row, 'model_fbx'),
                            'model_glb': get_cell_value(row, 'model_glb'),
                            'model_rfa': get_cell_value(row, 'model_rfa'),
                            'model_usdz': get_cell_value(row, 'model_usdz'),
                            'model_ar_glb': get_cell_value(row, 'model_ar_glb'),
                            'is_active': True,  # Всегда активируем товары при импорте
                        }
                        
                        # Создаем или обновляем по артикулу (если есть) или по названию
                        article = get_cell_value(row, 'article')
                        if article:
                            product, created = Product.objects.update_or_create(
                                article=article,
                                defaults={'title': title, **product_data}
                            )
                        else:
                            product, created = Product.objects.update_or_create(
                                title=title,
                                defaults=product_data
                            )
                        
                        if created:
                            created_count += 1
                        else:
                            updated_count += 1
                        
                        # Если есть артикул, ищем FileAsset по артикулу и автоматически связываем
                        if article:
                            try:
                                # Ищем FileAsset с asset_id, начинающимся с артикула
                                # Поддерживаем форматы: IMR-556065, IMR-556065(1), IMR-556065(2) и т.д.
                                matching_assets = FileAsset.objects.filter(
                                    asset_id__startswith=article,
                                    file_type='image'
                                ).order_by('asset_id')
                                
                                if matching_assets.exists():
                                    # Формируем список ID для image_asset_ids
                                    asset_ids = [asset.asset_id for asset in matching_assets]
                                    product.image_asset_ids = ','.join(asset_ids)
                                    product.save(update_fields=['image_asset_ids'])
                                    
                                    # Также создаем ProductImage для обратной совместимости
                                    for order, asset in enumerate(matching_assets):
                                        # Проверяем, не существует ли уже такое изображение
                                        existing_image = product.images.filter(
                                            image__icontains=os.path.basename(asset.file.name)
                                        ).first()
                                        
                                        if not existing_image and asset.file:
                                            # Копируем файл из FileAsset в ProductImage
                                            try:
                                                asset.file.open('rb')
                                                file_content = asset.file.read()
                                                asset.file.close()
                                                
                                                product_image = ProductImage(
                                                    product=product,
                                                    order=order
                                                )
                                                filename = os.path.basename(asset.file.name)
                                                product_image.image.save(
                                                    filename,
                                                    ContentFile(file_content),
                                                    save=True
                                                )
                                                images_attached_count += 1
                                            except Exception as img_error:
                                                errors.append(f"Строка {row_num}: ошибка при копировании изображения из FileAsset '{asset.asset_id}': {str(img_error)}")
                            except Exception as e:
                                errors.append(f"Строка {row_num}: ошибка при поиске FileAsset для артикула '{article}': {str(e)}")
                        
                        # Если загружен ZIP архив и есть артикул, обрабатываем файлы из ZIP
                        if zip_file and article and files_in_zip:
                            try:
                                # Ищем изображения по артикулу в ZIP
                                found_images = find_files_by_article(article, files_in_zip, 'image')
                                if found_images:
                                    # Создаем FileAsset для каждого изображения (если еще нет)
                                    image_asset_ids_list = []
                                    for order, image_path in enumerate(found_images, start=0):
                                        try:
                                            image_filename = os.path.basename(image_path)
                                            asset_id = os.path.splitext(image_filename)[0]
                                            
                                            # Проверяем, существует ли уже FileAsset
                                            file_asset = FileAsset.objects.filter(
                                                asset_id=asset_id,
                                                file_type='image'
                                            ).first()
                                            
                                            if not file_asset:
                                                # Читаем содержимое файла
                                                with open(image_path, 'rb') as f:
                                                    file_content = f.read()
                                                
                                                # Создаем FileAsset
                                                file_asset = FileAsset(
                                                    asset_id=asset_id,
                                                    file_type='image',
                                                    description=''
                                                )
                                                file_asset.file.save(image_filename, ContentFile(file_content), save=True)
                                            
                                            image_asset_ids_list.append(asset_id)
                                            
                                            # Проверяем, не существует ли уже такое изображение в ProductImage
                                            existing_images = product.images.all()
                                            image_exists = False
                                            for existing_img in existing_images:
                                                if existing_img.image and image_filename.lower() in existing_img.image.name.lower():
                                                    image_exists = True
                                                    break
                                            
                                            if not image_exists:
                                                # Создаем ProductImage
                                                file_asset.file.open('rb')
                                                file_content = file_asset.file.read()
                                                file_asset.file.close()
                                                
                                                product_image = ProductImage(
                                                    product=product,
                                                    order=order
                                                )
                                                product_image.image.save(
                                                    image_filename,
                                                    ContentFile(file_content),
                                                    save=True
                                                )
                                                images_attached_count += 1
                                        except Exception as img_error:
                                            errors.append(f"Строка {row_num}: ошибка при добавлении изображения '{os.path.basename(image_path)}': {str(img_error)}")
                                    
                                    # Обновляем image_asset_ids товара
                                    if image_asset_ids_list:
                                        product.image_asset_ids = ','.join(image_asset_ids_list)
                                        product.save(update_fields=['image_asset_ids'])
                                
                                # Ищем 3D модели по артикулу в ZIP
                                found_models = find_files_by_article(article, files_in_zip, '3d_model')
                                if found_models:
                                    # Создаем FileAsset для каждой 3D модели (если еще нет)
                                    model_asset_ids_list = []
                                    for model_path in found_models:
                                        try:
                                            model_filename = os.path.basename(model_path)
                                            asset_id = os.path.splitext(model_filename)[0]
                                            
                                            # Определяем расширение для установки соответствующего поля
                                            file_ext = os.path.splitext(model_filename)[1].lower()
                                            
                                            # Проверяем, существует ли уже FileAsset
                                            file_asset = FileAsset.objects.filter(
                                                asset_id=asset_id,
                                                file_type='3d_model'
                                            ).first()
                                            
                                            if not file_asset:
                                                # Читаем содержимое файла
                                                with open(model_path, 'rb') as f:
                                                    file_content = f.read()
                                                
                                                # Создаем FileAsset
                                                file_asset = FileAsset(
                                                    asset_id=asset_id,
                                                    file_type='3d_model',
                                                    description=''
                                                )
                                                file_asset.file.save(model_filename, ContentFile(file_content), save=True)
                                            
                                            model_asset_ids_list.append(asset_id)
                                            
                                            # Устанавливаем соответствующее поле модели в зависимости от расширения
                                            # Сохраняем относительный URL (полный URL будет формироваться в сериализаторе)
                                            if file_asset.file and hasattr(file_asset.file, 'url'):
                                                file_url = file_asset.file.url
                                                
                                                if file_ext == '.glb' and not product.model_glb:
                                                    product.model_glb = file_url
                                                elif file_ext == '.fbx' and not product.model_fbx:
                                                    product.model_fbx = file_url
                                                elif file_ext == '.usdz' and not product.model_usdz:
                                                    product.model_usdz = file_url
                                                elif file_ext == '.rfa' and not product.model_rfa:
                                                    product.model_rfa = file_url
                                            
                                        except Exception as model_error:
                                            errors.append(f"Строка {row_num}: ошибка при добавлении 3D модели '{os.path.basename(model_path)}': {str(model_error)}")
                                    
                                    # Обновляем model_3d_asset_ids товара
                                    if model_asset_ids_list:
                                        product.model_3d_asset_ids = ','.join(model_asset_ids_list)
                                        product.save(update_fields=['model_3d_asset_ids', 'model_glb', 'model_fbx', 'model_usdz', 'model_rfa'])
                                        models_attached_count += len(model_asset_ids_list)
                                
                            except Exception as e:
                                errors.append(f"Строка {row_num}: ошибка при поиске файлов в ZIP для артикула '{article}': {str(e)}")
                            
                    except Exception as e:
                        errors.append(f"Строка {row_num}: {str(e)}")
                
                # Очищаем временную директорию
                if temp_dir:
                    try:
                        shutil.rmtree(temp_dir, ignore_errors=True)
                    except:
                        pass
                
                # Формируем сообщение
                success_msg = f"Импорт завершен! Создано: {created_count}, обновлено: {updated_count}"
                if images_attached_count > 0:
                    success_msg += f", прикреплено изображений: {images_attached_count}"
                if models_attached_count > 0:
                    success_msg += f", прикреплено 3D моделей: {models_attached_count}"
                if created_count or updated_count or images_attached_count or models_attached_count:
                    messages.success(request, success_msg)
                
                if errors:
                    for error in errors[:10]:
                        messages.warning(request, error)
                    if len(errors) > 10:
                        messages.warning(request, f"... и еще {len(errors) - 10} ошибок")
                        
            except Exception as e:
                # Очищаем временную директорию в случае ошибки
                if temp_dir:
                    try:
                        shutil.rmtree(temp_dir, ignore_errors=True)
                    except:
                        pass
                messages.error(request, f"Ошибка при обработке файла: {str(e)}")
            
            return redirect("..")
        
        return render(request, "admin/catalog/import_excel.html")
    
