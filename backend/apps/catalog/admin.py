from django.contrib import admin
from django.utils.html import format_html
from django.shortcuts import render, redirect
from django.urls import path
from django.contrib import messages
from django.core.files import File
from django.core.files.base import ContentFile
from .models import Category, Product, ProductImage, FileAsset
import openpyxl
from decimal import Decimal
import os
from pathlib import Path
import zipfile
import tempfile
import shutil


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "parent", "preview_image")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}

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
                    
                    # Читаем Excel
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
                    
                    # Формат Excel: ID файла | Тип (image/3d_model) | Имя файла | Описание
                    for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                        try:
                            if not row[0]:  # Пропускаем пустые строки
                                continue
                            
                            asset_id = str(row[0]).strip()
                            file_type = str(row[1]).strip() if len(row) > 1 and row[1] else "image"
                            file_name = str(row[2]).strip() if len(row) > 2 and row[2] else ""
                            description = str(row[3]).strip() if len(row) > 3 and row[3] else ""
                            
                            if not file_name:
                                errors.append(f"Строка {row_num}: не указано имя файла")
                                continue
                            
                            # Нормализуем тип файла
                            file_type_lower = file_type.lower()
                            if file_type_lower in ['image', 'изображение', 'img', 'картинка', 'фото']:
                                file_type = 'image'
                            elif file_type_lower in ['3d_model', '3d', 'model', '3д', 'модель', '3d_модель']:
                                file_type = '3d_model'
                            else:
                                errors.append(f"Строка {row_num}: неизвестный тип файла '{file_type}'")
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
                                existing.description = description
                                existing.file.save(save_filename, ContentFile(file_content), save=True)
                                updated_count += 1
                            else:
                                # Создаем новый
                                file_asset = FileAsset(
                                    asset_id=asset_id,
                                    file_type=file_type,
                                    description=description
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


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "category",
        "price",
        "material",
        "style",
        "color",
        "is_active",
        "is_trending",
    )
    list_filter = ("category", "material", "style", "color", "is_active", "is_trending")
    search_fields = ("title", "description")
    list_editable = ("price", "is_active", "is_trending")
    inlines = [ProductImageInline]
    
    # Добавляем поля для связи с файловыми ресурсами
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'category', 'description', 'price')
        }),
        ('Характеристики', {
            'fields': ('material', 'style', 'color')
        }),
        ('Настройки', {
            'fields': ('is_active', 'is_trending')
        }),
        ('Файловые ресурсы (ID из таблицы FileAsset)', {
            'fields': ('image_asset_ids', 'model_3d_asset_ids'),
            'description': 'Укажите ID файлов из таблицы "Файловые ресурсы" через запятую'
        }),
        ('Старый метод (для совместимости)', {
            'fields': ('image',),
            'classes': ('collapse',)
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
                
                # Сначала импортируем файлы (если есть лист "Файлы")
                files_imported = 0
                files_errors = []
                
                if "Файлы" in wb.sheetnames or "Files" in wb.sheetnames:
                    files_sheet = wb["Файлы"] if "Файлы" in wb.sheetnames else wb["Files"]
                    files_imported, files_errors = self._import_files(files_sheet, request)
                
                # Теперь импортируем товары
                ws = wb["Товары"] if "Товары" in wb.sheetnames else wb.active
                
                created_count = 0
                updated_count = 0
                errors = []
                
                # Пропускаем заголовок
                for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
                    try:
                        if not row[0]:  # Пропускаем пустые строки
                            continue
                        
                        title = row[0]
                        material = row[1] if len(row) > 1 else ""
                        price = Decimal(str(row[2])) if len(row) > 2 and row[2] else Decimal('0.00')
                        image_asset_ids = row[3] if len(row) > 3 else ""
                        model_3d_asset_ids = row[4] if len(row) > 4 else ""
                        category_id = row[5] if len(row) > 5 and row[5] else None
                        description = row[6] if len(row) > 6 else ""
                        style = row[7] if len(row) > 7 else ""
                        color = row[8] if len(row) > 8 else ""
                        
                        # Получаем или создаем категорию по умолчанию
                        if category_id:
                            try:
                                category = Category.objects.get(id=category_id)
                            except Category.DoesNotExist:
                                errors.append(f"Строка {row_num}: Категория с ID {category_id} не найдена")
                                continue
                        else:
                            category, _ = Category.objects.get_or_create(
                                slug='default',
                                defaults={'name': 'Без категории'}
                            )
                        
                        # Создаем или обновляем продукт
                        product, created = Product.objects.update_or_create(
                            title=title,
                            defaults={
                                'material': material,
                                'price': price,
                                'image_asset_ids': image_asset_ids,
                                'model_3d_asset_ids': model_3d_asset_ids,
                                'category': category,
                                'description': description,
                                'style': style,
                                'color': color,
                            }
                        )
                        
                        if created:
                            created_count += 1
                        else:
                            updated_count += 1
                            
                    except Exception as e:
                        errors.append(f"Строка {row_num}: {str(e)}")
                
                # Формируем сообщение
                success_parts = []
                if files_imported > 0:
                    success_parts.append(f"Файлов загружено: {files_imported}")
                if created_count or updated_count:
                    success_parts.append(f"Товаров создано: {created_count}, обновлено: {updated_count}")
                
                if success_parts:
                    messages.success(request, "Импорт завершен! " + ", ".join(success_parts))
                
                # Показываем ошибки файлов
                if files_errors:
                    for error in files_errors[:5]:
                        messages.warning(request, f"[Файлы] {error}")
                    if len(files_errors) > 5:
                        messages.warning(request, f"... и еще {len(files_errors) - 5} ошибок с файлами")
                
                # Показываем ошибки товаров
                if errors:
                    for error in errors[:10]:
                        messages.warning(request, error)
                    if len(errors) > 10:
                        messages.warning(request, f"... и еще {len(errors) - 10} ошибок с товарами")
                        
            except Exception as e:
                messages.error(request, f"Ошибка при обработке файла: {str(e)}")
            
            return redirect("..")
        
        return render(request, "admin/catalog/import_excel.html")
    
    def _import_files(self, worksheet, request):
        """Импорт файлов из листа Excel"""
        import_files_dir = Path(__file__).resolve().parent.parent.parent / 'import_files'
        
        imported = 0
        errors = []
        
        # Формат: ID файла | Тип (image/3d_model) | Имя файла | Описание
        for row_num, row in enumerate(worksheet.iter_rows(min_row=2, values_only=True), start=2):
            try:
                if not row[0]:  # Пропускаем пустые строки
                    continue
                
                asset_id = str(row[0]).strip()
                file_type = str(row[1]).strip() if len(row) > 1 else "image"
                file_name = str(row[2]).strip() if len(row) > 2 else ""
                description = str(row[3]).strip() if len(row) > 3 else ""
                
                if not file_name:
                    errors.append(f"Строка {row_num}: не указано имя файла")
                    continue
                
                # Проверяем, существует ли уже FileAsset с таким ID
                if FileAsset.objects.filter(asset_id=asset_id).exists():
                    errors.append(f"Строка {row_num}: FileAsset с ID '{asset_id}' уже существует")
                    continue
                
                # Нормализуем тип файла
                if file_type.lower() in ['image', 'изображение', 'img']:
                    file_type = 'image'
                elif file_type.lower() in ['3d_model', '3d', 'model', '3д', 'модель']:
                    file_type = '3d_model'
                else:
                    errors.append(f"Строка {row_num}: неизвестный тип файла '{file_type}'")
                    continue
                
                # Ищем файл в папке import_files
                file_path = import_files_dir / file_name
                
                if not file_path.exists():
                    errors.append(f"Строка {row_num}: файл '{file_name}' не найден в папке import_files/")
                    continue
                
                # Создаем FileAsset
                with open(file_path, 'rb') as f:
                    django_file = File(f, name=file_name)
                    FileAsset.objects.create(
                        asset_id=asset_id,
                        file_type=file_type,
                        file=django_file,
                        description=description
                    )
                
                imported += 1
                
            except Exception as e:
                errors.append(f"Строка {row_num}: {str(e)}")
        
        return imported, errors
