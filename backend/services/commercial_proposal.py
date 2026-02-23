"""
Сервис генерации коммерческого предложения (КП) в формате PDF.
Формирует таблицу с фото, ценой, габаритами товаров из корзины.
"""
import io
import os
import tempfile
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    Image as RLImage, PageBreak, Frame, PageTemplate
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from django.conf import settings


def register_fonts():
    """Регистрирует шрифты для поддержки кириллицы"""
    # Пробуем найти шрифт в системе
    font_paths = [
        # Windows
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        'C:/Windows/Fonts/ariali.ttf',
        # Linux
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        # macOS
        '/Library/Fonts/Arial.ttf',
    ]
    
    registered = False
    
    # Пробуем Arial
    for path in font_paths:
        if os.path.exists(path):
            try:
                if 'arialbd' in path.lower() or 'Bold' in path:
                    pdfmetrics.registerFont(TTFont('Arial-Bold', path))
                elif 'ariali' in path.lower() or 'Italic' in path:
                    pdfmetrics.registerFont(TTFont('Arial-Italic', path))
                else:
                    pdfmetrics.registerFont(TTFont('Arial', path))
                    registered = True
            except Exception:
                pass
    
    if not registered:
        # Пробуем DejaVu как запасной вариант
        dejavu_paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        ]
        for path in dejavu_paths:
            if os.path.exists(path):
                try:
                    if 'Bold' in path:
                        pdfmetrics.registerFont(TTFont('Arial-Bold', path))
                    else:
                        pdfmetrics.registerFont(TTFont('Arial', path))
                        registered = True
                except Exception:
                    pass
    
    if not registered:
        # Используем встроенный Helvetica (без кириллицы, но хотя бы не падает)
        # В реальном проекте нужно положить Arial.ttf в проект
        pass
    
    return registered


def get_font_name(bold=False):
    """Возвращает имя шрифта для использования"""
    try:
        if bold:
            pdfmetrics.getFont('Arial-Bold')
            return 'Arial-Bold'
        else:
            pdfmetrics.getFont('Arial')
            return 'Arial'
    except KeyError:
        return 'Helvetica-Bold' if bold else 'Helvetica'


def get_product_image(product):
    """Получает путь к изображению товара для КП.
    Использует уже загруженные фото товара (ProductImage, FileAsset, image).
    """
    # Приоритет 1: Первое изображение из ProductImage (загружены через импорт/админку)
    if product.images.exists():
        first_image = product.images.first()
        if first_image and first_image.image and hasattr(first_image.image, 'path'):
            try:
                if os.path.exists(first_image.image.path):
                    return first_image.image.path
            except Exception:
                pass
    
    # Приоритет 2: Изображения из FileAsset по ID
    image_assets = product.get_image_assets()
    if image_assets.exists():
        first_asset = image_assets.first()
        if first_asset and first_asset.file and hasattr(first_asset.file, 'path'):
            try:
                if os.path.exists(first_asset.file.path):
                    return first_asset.file.path
            except Exception:
                pass
    
    # Приоритет 3: Основное изображение товара (старое поле image)
    if product.image and hasattr(product.image, 'path'):
        try:
            if os.path.exists(product.image.path):
                return product.image.path
        except Exception:
            pass
    
    return None


def format_dimensions(product):
    """Форматирует габариты товара для КП"""
    dims = []
    if product.width:
        dims.append(str(int(product.width)))
    if product.depth:
        dims.append(str(int(product.depth)))
    if product.height:
        dims.append(str(int(product.height)))
    
    if dims:
        return f"Габариты (ш*г*в):\n{'x'.join(dims)}"
    return ""


def generate_commercial_proposal_pdf(proposal_request):
    """
    Генерирует PDF коммерческого предложения.
    
    Args:
        proposal_request: CommercialProposalRequest instance
    
    Returns:
        bytes: PDF файл в виде байтов
    """
    register_fonts()
    
    font_name = get_font_name()
    font_name_bold = get_font_name(bold=True)
    
    buffer = io.BytesIO()
    
    # Создаем документ в альбомной ориентации A4
    page_width, page_height = landscape(A4)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=25 * mm,
    )
    
    # Стили
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CPTitle',
        parent=styles['Title'],
        fontName=font_name_bold,
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=10,
        leading=20,
    )
    
    header_style = ParagraphStyle(
        'CPHeader',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        alignment=TA_LEFT,
        spaceAfter=3,
        leading=14,
    )
    
    header_bold_style = ParagraphStyle(
        'CPHeaderBold',
        parent=styles['Normal'],
        fontName=font_name_bold,
        fontSize=10,
        alignment=TA_LEFT,
        spaceAfter=3,
        leading=14,
    )
    
    cell_style = ParagraphStyle(
        'CPCell',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=8,
        alignment=TA_CENTER,
        leading=10,
    )
    
    cell_left_style = ParagraphStyle(
        'CPCellLeft',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=8,
        alignment=TA_LEFT,
        leading=10,
    )
    
    cell_small_style = ParagraphStyle(
        'CPCellSmall',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=7,
        alignment=TA_CENTER,
        leading=9,
        wordWrap='CJK',
    )
    
    header_cell_style = ParagraphStyle(
        'CPHeaderCell',
        parent=styles['Normal'],
        fontName=font_name_bold,
        fontSize=8,
        alignment=TA_CENTER,
        leading=10,
    )
    
    note_style = ParagraphStyle(
        'CPNote',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=7,
        alignment=TA_LEFT,
        leading=9,
    )
    
    # Элементы для документа
    elements = []
    
    basket = proposal_request.basket
    items = basket.items.select_related('product').all()
    
    # === ЗАГОЛОВОК ===
    elements.append(Paragraph("КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", title_style))
    elements.append(Spacer(1, 5 * mm))
    
    # === МЕТА-ИНФОРМАЦИЯ ===
    # Форматируем дату
    date_str = proposal_request.created_at.strftime('%d %B %Y г.')
    # Русские месяцы
    months_ru = {
        'January': 'января', 'February': 'февраля', 'March': 'марта',
        'April': 'апреля', 'May': 'мая', 'June': 'июня',
        'July': 'июля', 'August': 'августа', 'September': 'сентября',
        'October': 'октября', 'November': 'ноября', 'December': 'декабря',
    }
    date_str = proposal_request.created_at.strftime('%d {month} %Y г.')
    month_en = proposal_request.created_at.strftime('%B')
    date_str = date_str.replace('{month}', months_ru.get(month_en, month_en))
    
    elements.append(Paragraph(f"<b>Дата:</b> {date_str}", header_style))
    elements.append(Paragraph(f"<b>Клиент:</b> {proposal_request.client_name}", header_style))
    
    if proposal_request.company_name:
        elements.append(Paragraph(f"<b>От:</b> {proposal_request.company_name}", header_style))
    
    elements.append(Paragraph(f"<b>Проект:</b> {proposal_request.project_name}", header_style))
    elements.append(Spacer(1, 8 * mm))
    
    # === ТАБЛИЦА ТОВАРОВ ===
    # Заголовки таблицы
    table_header = [
        Paragraph('ID', header_cell_style),
        Paragraph('Наименование', header_cell_style),
        Paragraph('Изображение', header_cell_style),
        Paragraph('Кол-во,<br/>шт', header_cell_style),
        Paragraph('Цена за<br/>шт., руб.', header_cell_style),
        Paragraph('Сумма,<br/>руб.', header_cell_style),
        Paragraph('Магазин,<br/>ссылка', header_cell_style),
        Paragraph('Примечание', header_cell_style),
    ]
    
    table_data = [table_header]
    
    total_sum = 0
    
    for idx, item in enumerate(items, start=1):
        product = item.product
        quantity = item.quantity
        price = float(product.price)
        item_total = price * quantity
        total_sum += item_total
        
        # ID
        item_id = Paragraph(f'M-{idx}', cell_style)
        
        # Наименование
        item_name = Paragraph(product.title, cell_left_style)
        
        # Изображение
        img_path = get_product_image(product)
        if img_path:
            try:
                img = RLImage(img_path, width=60, height=60)
                img.hAlign = 'CENTER'
                item_image = img
            except Exception:
                item_image = Paragraph('—', cell_style)
        else:
            item_image = Paragraph('—', cell_style)
        
        # Количество
        item_qty = Paragraph(str(quantity), cell_style)
        
        # Цена
        item_price = Paragraph(f'{price:,.0f}'.replace(',', ' '), cell_style)
        
        # Сумма
        item_sum = Paragraph(f'{item_total:,.0f}'.replace(',', ' '), cell_style)
        
        # Ссылка на магазин
        shop_url = product.shop_url or ''
        if shop_url:
            # Сокращаем URL для отображения
            display_url = shop_url.replace('https://', '').replace('http://', '')
            if len(display_url) > 35:
                display_url = display_url[:35] + '...'
            item_shop = Paragraph(f'<a href="{shop_url}" color="blue">{display_url}</a>', cell_small_style)
        else:
            item_shop = Paragraph('—', cell_style)
        
        # Примечание (габариты + доп. информация)
        notes_parts = []
        dims = format_dimensions(product)
        if dims:
            notes_parts.append(dims)
        
        if product.cp_notes:
            notes_parts.append(product.cp_notes)
        elif product.brand:
            notes_parts.append(f"Производитель: {product.brand}")
        
        item_notes = Paragraph('<br/>'.join(notes_parts) if notes_parts else '—', cell_small_style)
        
        table_data.append([
            item_id, item_name, item_image, item_qty, 
            item_price, item_sum, item_shop, item_notes
        ])
    
    # Определяем ширины столбцов
    available_width = page_width - 30 * mm  # margins
    col_widths = [
        30,   # ID
        90,   # Наименование
        75,   # Изображение
        40,   # Кол-во
        55,   # Цена
        55,   # Сумма
        90,   # Магазин
        available_width - 30 - 90 - 75 - 40 - 55 - 55 - 90,  # Примечание
    ]
    
    # Минимальная высота строк
    row_heights = [25]  # заголовок
    for _ in items:
        row_heights.append(75)  # строки с товарами
    
    table = Table(table_data, colWidths=col_widths, rowHeights=row_heights)
    
    table.setStyle(TableStyle([
        # Заголовок
        ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.85, 0.85, 0.85)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('FONTNAME', (0, 0), (-1, 0), font_name_bold),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        
        # Все ячейки
        ('GRID', (0, 0), (-1, -1), 0.5, colors.Color(0.6, 0.6, 0.6)),
        ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # ID - по центру
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),  # Изображение - по центру
        ('ALIGN', (3, 1), (5, -1), 'CENTER'),  # Кол-во, Цена, Сумма - по центру
        
        # Чередование фона строк
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.97, 0.97, 0.97)]),
        
        # Padding
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 5 * mm))
    
    # === ИТОГО ===
    total_style = ParagraphStyle(
        'CPTotal',
        parent=styles['Normal'],
        fontName=font_name_bold,
        fontSize=12,
        alignment=TA_RIGHT,
        spaceAfter=5,
    )
    elements.append(Paragraph(
        f"ИТОГО: {total_sum:,.0f} руб.".replace(',', ' '),
        total_style
    ))
    elements.append(Spacer(1, 8 * mm))
    
    # === ПРИМЕЧАНИЯ ===
    elements.append(Paragraph("<b>Примечания:</b>", header_bold_style))
    elements.append(Paragraph(
        "1. Смотреть совместно с планом расстановки мебели и развертками.",
        note_style
    ))
    elements.append(Paragraph(
        "2. Детальные чертежи для мебели индивидуального производства составлять совместно с поставщиками.",
        note_style
    ))
    elements.append(Spacer(1, 10 * mm))
    
    # === КАРТОЧКА ПРОЕКТА (нижний правый угол) ===
    card_data = [
        [Paragraph('<b>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</b>', ParagraphStyle(
            'CardTitle', fontName=font_name_bold, fontSize=8, alignment=TA_CENTER, leading=10
        ))],
        [Paragraph(f'Дизайн-проект: {proposal_request.project_name}', ParagraphStyle(
            'CardProject', fontName=font_name, fontSize=7, alignment=TA_CENTER, leading=9
        ))],
    ]
    
    card_table = Table(card_data, colWidths=[150])
    card_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.Color(0.6, 0.6, 0.6)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    # Обертка для позиционирования карточки справа
    wrapper_data = [['', card_table]]
    wrapper_table = Table(wrapper_data, colWidths=[available_width - 160, 160])
    wrapper_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    elements.append(wrapper_table)
    
    # Собираем PDF
    doc.build(elements)
    
    buffer.seek(0)
    return buffer.getvalue()


def send_proposal_email(proposal_request, pdf_bytes):
    """Отправляет КП по email"""
    from django.core.mail import EmailMessage
    
    subject = f"Коммерческое предложение - {proposal_request.project_name}"
    body = (
        f"Здравствуйте, {proposal_request.client_name}!\n\n"
        f"Направляем Вам коммерческое предложение по проекту «{proposal_request.project_name}».\n\n"
        f"Дата: {proposal_request.created_at.strftime('%d.%m.%Y')}\n"
    )
    if proposal_request.company_name:
        body += f"От: {proposal_request.company_name}\n"
    body += "\nС уважением,\nКоманда VIZHUB.PRO"
    
    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[proposal_request.email],
    )
    
    filename = f"КП_{proposal_request.project_name}_{proposal_request.created_at.strftime('%Y%m%d')}.pdf"
    email.attach(filename, pdf_bytes, 'application/pdf')
    email.send()


def send_proposal_telegram(proposal_request, pdf_bytes):
    """Отправляет КП в Telegram"""
    import requests
    
    bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not bot_token:
        raise ValueError("TELEGRAM_BOT_TOKEN не настроен в settings.py")
    
    telegram_id = proposal_request.telegram.strip()
    
    # Убираем @ если есть
    if telegram_id.startswith('@'):
        telegram_id = telegram_id[1:]
    
    # Отправляем сообщение
    caption = (
        f"📋 Коммерческое предложение\n\n"
        f"Проект: {proposal_request.project_name}\n"
        f"Клиент: {proposal_request.client_name}\n"
        f"Дата: {proposal_request.created_at.strftime('%d.%m.%Y')}\n"
    )
    if proposal_request.company_name:
        caption += f"От: {proposal_request.company_name}\n"
    
    filename = f"КП_{proposal_request.project_name}_{proposal_request.created_at.strftime('%Y%m%d')}.pdf"
    
    url = f"https://api.telegram.org/bot{bot_token}/sendDocument"
    
    files = {
        'document': (filename, pdf_bytes, 'application/pdf'),
    }
    data = {
        'chat_id': telegram_id,
        'caption': caption,
    }
    
    response = requests.post(url, data=data, files=files, timeout=30)
    
    if response.status_code != 200:
        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        raise ValueError(
            f"Ошибка отправки в Telegram: {error_data.get('description', response.text)}"
        )
