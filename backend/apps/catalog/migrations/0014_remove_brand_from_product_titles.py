# Generated manually - remove brand from existing product titles

import re
from django.db import migrations


def strip_brand_from_title(title: str, brand: str) -> str:
    """Удаляет бренд из названия. Не удаляет, если brand похож на цвет. Пробует полный бренд и каждое слово."""
    if not title or not brand or not brand.strip():
        return title
    color_pattern = re.compile(
        r'цвета?$|цветовой|коричнев|чёрн|черн|бел|син|сер|красн|зелен|зёл|жёлт|оранж|беж|золот|серебр|фиолет|розов',
        re.IGNORECASE
    )
    # Пробуем полный бренд, затем каждое слово (от длинного к короткому), если слово >= 2 символов
    brand_str = brand.strip()
    tokens = [brand_str] + [t.strip() for t in brand_str.split() if len(t.strip()) >= 2]
    tokens = list(dict.fromkeys(tokens))  # порядок: полный бренд, затем слова
    result = title
    for token in sorted(tokens, key=len, reverse=True):
        if color_pattern.search(token):
            continue
        escaped = re.escape(token)
        pattern = re.compile(r'\s*' + escaped + r'\s*', re.IGNORECASE)
        new_result = re.sub(r'\s+', ' ', pattern.sub(' ', result)).strip()
        if new_result and new_result != result:
            result = new_result
    return result if result else title


def remove_brand_from_titles(apps, schema_editor):
    """Обновляет title у существующих товаров: удаляет бренд из названия."""
    Product = apps.get_model('catalog', 'Product')
    updated = 0
    for product in Product.objects.all():
        new_title = strip_brand_from_title(product.title or '', product.brand or '')
        if new_title != product.title:
            product.title = new_title
            product.save(update_fields=['title'])
            updated += 1
    if updated:
        print(f'Обновлено названий товаров (бренд удалён): {updated}')


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0013_category_unlock_day'),
    ]

    operations = [
        migrations.RunPython(remove_brand_from_titles, noop),
    ]
