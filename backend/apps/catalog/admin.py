from django.contrib import admin
from django.utils.html import format_html
from django.shortcuts import render, redirect
from django.urls import path
from django.contrib import messages
from django.core.files import File
from django.core.files.base import ContentFile
from django.http import HttpResponse
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


@admin.register(FileAsset)
class FileAssetAdmin(admin.ModelAdmin):
    list_display = ("asset_id", "file_type", "file", "description", "created_at", "preview")
    list_filter = ("file_type", "created_at")
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
        ]
        return custom_urls + urls
    
    def import_files_view(self, request):
        """Массовый импорт файлов через Excel + ZIP архив"""
        if request.method == "POST":
            excel_file = request.FILES.get('excel_file')
            zip_file = request.FILES.get('zip_file')
            
            if not excel_file:
                messages.error(request, "Пожалуйста, выберите Excel файл")
                return redirect("..")
            
            if not zip_file:
                messages.error(request, "Пожалуйста, выберите ZIP архив с файлами")
                return redirect("..")
            
            try:
                # Создаем временную директорию для распаковки
                temp_dir = tempfile.mkdtemp()
                
                try:
                    # Распаковываем ZIP
                    with zipfile.ZipFile(zip_file, 'r') as zf:
                        zf.extractall(temp_dir)
                    
                    # Читаем Excel с вычислением формул (data_only=True)
                    # Если формулы не вычислены, пробуем без data_only
                    try:
                        wb = openpyxl.load_workbook(excel_file, data_only=True)
                    except:
                        wb = openpyxl.load_workbook(excel_file)
                    ws = wb.active
                    
                    created_count = 0
                    updated_count = 0
                    errors = []
                    
                    # Собираем все файлы из архива (включая вложенные папки)
                    files_in_zip = {}
                    for root, dirs, files in os.walk(temp_dir):
                        for filename in files:
                            # Игнорируем системные файлы macOS
                            if filename.startswith('.') or filename == '__MACOSX':
                                continue
                            full_path = os.path.join(root, filename)
                            # Сохраняем по имени файла (без пути)
                            files_in_zip[filename.lower()] = full_path
                            # Также сохраняем с относительным путём
                            rel_path = os.path.relpath(full_path, temp_dir)
                            files_in_zip[rel_path.lower()] = full_path
                    
                    # Формат Excel: URL | Имя файла | ID файла | Тип файла
                    for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                        try:
                            # URL (столбец 0) - используется для извлечения имени файла, если в столбце B формула
                            url_raw = str(row[0]).strip() if len(row) > 0 and row[0] else ""
                            file_name_raw = str(row[1]).strip() if len(row) > 1 and row[1] else ""
                            asset_id = str(row[2]).strip() if len(row) > 2 and row[2] else ""
                            file_type = str(row[3]).strip() if len(row) > 3 and row[3] else "image"
                            
                            # Обрабатываем URL (если это формула, она должна быть вычислена data_only=True)
                            url = url_raw
                            if url.startswith('='):
                                # Если URL тоже формула и не вычислена, пропускаем эту строку
                                errors.append(f"Строка {row_num}: URL содержит невычисленную формулу")
                                continue
                            
                            # Если имя файла начинается с "=", это формула Excel - извлекаем имя из URL
                            if file_name_raw.startswith('='):
                                # Извлекаем имя файла из URL (последняя часть пути)
                                if url:
                                    # Обрабатываем как Windows путь (обратные слэши) или URL (прямые слэши)
                                    file_name = os.path.basename(url.replace('\\', '/'))
                                    # Убираем параметры запроса и якоря из URL, если есть
                                    if '?' in file_name:
                                        file_name = file_name.split('?')[0]
                                    if '#' in file_name:
                                        file_name = file_name.split('#')[0]
                                else:
                                    errors.append(f"Строка {row_num}: не указан URL для извлечения имени файла")
                                    continue
                            else:
                                file_name = file_name_raw
                            
                            # Пропускаем пустые строки (проверяем ID файла и имя файла)
                            if not asset_id and not file_name:
                                continue
                            
                            if not file_name:
                                errors.append(f"Строка {row_num}: не указано имя файла")
                                continue
                            
                            if not asset_id:
                                errors.append(f"Строка {row_num}: не указан ID файла")
                                continue
                            
                            # Нормализуем тип файла
                            file_type_lower = file_type.lower()
                            recognized_type = False
                            
                            if file_type_lower in ['image', 'изображение', 'img', 'картинка', 'фото']:
                                file_type = 'image'
                                recognized_type = True
                            elif file_type_lower in ['3d_model', '3d', 'model', '3д', 'модель', '3d_модель']:
                                file_type = '3d_model'
                                recognized_type = True
                            
                            # Если тип файла не распознан, определяем автоматически по расширению
                            if not recognized_type:
                                # Получаем расширение файла
                                file_ext = os.path.splitext(file_name)[1].lower().lstrip('.')
                                
                                # Определяем тип по расширению
                                image_extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg']
                                model_extensions = ['glb', 'gltf', 'fbx', 'obj', 'usdz', 'rfa', 'dae', '3ds']
                                
                                if file_ext in image_extensions:
                                    file_type = 'image'
                                elif file_ext in model_extensions:
                                    file_type = '3d_model'
                                else:
                                    errors.append(f"Строка {row_num}: не удалось определить тип файла для '{file_name}' (расширение: {file_ext})")
                                    continue
                            
                            # Ищем файл в архиве
                            file_path = files_in_zip.get(file_name.lower())
                            if not file_path:
                                # Пробуем найти без расширения
                                base_name = os.path.splitext(file_name)[0].lower()
                                for key, path in files_in_zip.items():
                                    if os.path.splitext(key)[0] == base_name:
                                        file_path = path
                                        break
                            
                            if not file_path:
                                errors.append(f"Строка {row_num}: файл '{file_name}' не найден в ZIP архиве")
                                continue
                            
                            # Читаем содержимое файла
                            with open(file_path, 'rb') as f:
                                file_content = f.read()
                            
                            # Определяем имя файла для сохранения
                            save_filename = os.path.basename(file_path)
                            
                            # Проверяем, существует ли уже FileAsset с таким ID
                            existing = FileAsset.objects.filter(asset_id=asset_id).first()
                            if existing:
                                # Обновляем существующий
                                existing.file_type = file_type
                                existing.file.save(save_filename, ContentFile(file_content), save=True)
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
                                
                        except Exception as e:
                            errors.append(f"Строка {row_num}: {str(e)}")
                    
                    # Формируем сообщение
                    if created_count or updated_count:
                        messages.success(
                            request, 
                            f"Импорт завершен! Создано: {created_count}, обновлено: {updated_count}"
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
            if not excel_file:
                messages.error(request, "Пожалуйста, выберите Excel файл")
                return redirect("..")
            
            try:
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
                    'model_3d_asset_ids': ['id 3d моделей', 'model_3d_asset_ids', '3d_asset_ids', 'id 3d', 'id модели', 'id моделей'],
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
                
                # Пропускаем заголовок
                for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                    try:
                        title = get_cell_value(row, 'title')
                        if not title:
                            continue  # Пропускаем пустые строки
                        
                        # Получаем цену
                        price = get_decimal_value(row, 'price', Decimal('0.00'))
                        
                        # Получаем категорию
                        category_name = get_cell_value(row, 'category', 'Без категории')
                        if category_name:
                            category, _ = Category.objects.get_or_create(
                                name=category_name,
                                defaults={'slug': category_name.lower().replace(' ', '-')}
                            )
                        else:
                            category, _ = Category.objects.get_or_create(
                                slug='default',
                                defaults={'name': 'Без категории'}
                            )
                        
                        # Получаем ID из первой колонки (если есть)
                        product_id = get_cell_value(row, 'id', '')
                        
                        # Получаем ID изображений и 3D моделей из Excel (если указаны)
                        image_asset_ids = get_cell_value(row, 'image_asset_ids', '')
                        model_3d_asset_ids = get_cell_value(row, 'model_3d_asset_ids', '')
                        
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
                            
                    except Exception as e:
                        errors.append(f"Строка {row_num}: {str(e)}")
                
                # Формируем сообщение
                if created_count or updated_count:
                    messages.success(request, f"Импорт завершен! Создано: {created_count}, обновлено: {updated_count}")
                
                if errors:
                    for error in errors[:10]:
                        messages.warning(request, error)
                    if len(errors) > 10:
                        messages.warning(request, f"... и еще {len(errors) - 10} ошибок")
                        
            except Exception as e:
                messages.error(request, f"Ошибка при обработке файла: {str(e)}")
            
            return redirect("..")
        
        return render(request, "admin/catalog/import_excel.html")
    
