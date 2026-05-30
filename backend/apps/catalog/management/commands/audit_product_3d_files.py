"""
Диагностика 3D-файлов: папки админки vs поля товара vs FileAsset.

  python manage.py audit_product_3d_files
  python manage.py audit_product_3d_files --category стул
  python manage.py audit_product_3d_files --category "диван" --category прям
"""
from django.core.management.base import BaseCommand
from django.db.models import Count, Q

from apps.catalog.models import Category, Product
from apps.catalog.product_model_files import (
    product_has_glb,
    product_has_ifc,
    product_has_rfa,
    product_model_files_q_components,
    url_has_extension,
)


class Command(BaseCommand):
    help = "Сводка GLB/RFA/IFC по категориям и типичные расхождения (папки vs таблица)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--category",
            action="append",
            default=[],
            help="Фильтр по подстроке в названии категории (можно несколько раз)",
        )
        parser.add_argument(
            "--category-id",
            type=int,
            default=None,
            help="Точный id категории (надёжнее кириллицы в SSH)",
        )
        parser.add_argument("--limit", type=int, default=15, help="Примеров в каждом блоке")

    def handle(self, *args, **options):
        needles = [n.strip().lower() for n in options["category"] if n and n.strip()]
        category_id = options.get("category_id")
        limit = max(1, options["limit"])

        has_glb, has_rfa, has_ifc = product_model_files_q_components()
        has_fbx = Q(model_fbx__isnull=False) & ~Q(model_fbx="")

        cats = Category.objects.all().order_by("order", "id")
        if category_id is not None:
            cats = cats.filter(pk=category_id)
        elif needles:
            q_cat = Q()
            for n in needles:
                q_cat |= Q(name__icontains=n)
            cats = cats.filter(q_cat)

        if not cats.exists():
            self.stdout.write(
                self.style.WARNING(
                    "Категории не найдены по фильтру. "
                    "Попробуйте --category-id 14 или audit без фильтра. "
                    "В SSH кириллица в --category часто ломается — используйте id."
                )
            )
            self.stdout.write("Все категории в БД:")
            for c in Category.objects.all().order_by("order", "id"):
                n = Product.objects.filter(category_id=c.id).count()
                self.stdout.write(f"  id={c.id}  {c.name!r}  товаров={n}")
            return

        self.stdout.write(self.style.MIGRATE_HEADING("Категории (как «папки» в админке)"))
        self.stdout.write(
            f"{'ID':>6}  {'Категория':<40}  {'всего':>6}  {'GLB':>6}  {'RFA':>6}  {'IFC':>6}  {'комплект':>8}"
        )
        rows_shown = 0
        for cat in cats:
            agg = Product.objects.filter(category_id=cat.id).aggregate(
                total=Count("id"),
                n_glb=Count("id", filter=has_glb),
                n_rfa=Count("id", filter=has_rfa),
                n_ifc=Count("id", filter=has_ifc),
                n_bundle=Count("id", filter=has_glb & has_rfa & has_ifc),
            )
            if agg["total"] == 0 and (needles or category_id is not None):
                self.stdout.write(
                    self.style.WARNING(
                        f"{cat.id:6d}  {cat.name[:40]:<40}  {agg['total']:6d}  "
                        f"(категория есть, но товаров с category_id={cat.id} нет в БД)"
                    )
                )
                rows_shown += 1
                continue
            self.stdout.write(
                f"{cat.id:6d}  {cat.name[:40]:<40}  {agg['total']:6d}  "
                f"{agg['n_glb']:6d}  {agg['n_rfa']:6d}  {agg['n_ifc']:6d}  {agg['n_bundle']:8d}"
            )
            rows_shown += 1

        if rows_shown == 0:
            self.stdout.write(self.style.WARNING("  (нет строк — см. список категорий выше при пустом фильтре)"))

        base_qs = Product.objects.all()
        if needles:
            base_qs = base_qs.filter(category__in=cats)

        self.stdout.write("")
        self._section_assets_no_fields(base_qs, limit)
        self._section_ifc_mismatch(base_qs, limit)
        self._section_subcategory_hint(base_qs, limit)

    def _section_assets_no_fields(self, qs, limit: int) -> None:
        self.stdout.write(self.style.MIGRATE_HEADING("FileAsset есть, поля model_* пустые или без расширения"))
        n = 0
        for p in qs.filter(model_3d_asset_ids__gt="").iterator(chunk_size=200):
            assets = list(p.get_3d_model_assets())
            if not assets:
                continue
            if product_has_glb(p) and product_has_rfa(p) and product_has_ifc(p):
                continue
            exts = []
            for a in assets:
                if a.file and a.file.name:
                    exts.append(a.file.name.rsplit(".", 1)[-1].lower())
            if not exts:
                continue
            self.stdout.write(
                f"  id={p.pk} cat={p.category.name!r} article={p.article!r} "
                f"FileAsset: {','.join(sorted(set(exts)))} | "
                f"поля GLB={product_has_glb(p)} RFA={product_has_rfa(p)} IFC={product_has_ifc(p)}"
            )
            n += 1
            if n >= limit:
                break
        if n == 0:
            self.stdout.write("  (нет примеров)")
        else:
            self.stdout.write(
                f"  → Импорт «Файлы» / Excel+ZIP в админке, либо: "
                f"manage.py backfill_model_formats_from_assets"
            )

    def _section_ifc_mismatch(self, qs, limit: int) -> None:
        self.stdout.write(self.style.MIGRATE_HEADING("model_ifc заполнено, но URL без «.ifc» (папка IFC = 0)"))
        n = 0
        for p in qs.exclude(model_ifc="").iterator(chunk_size=300):
            if product_has_ifc(p):
                continue
            raw = (p.model_ifc or "")[:100]
            self.stdout.write(f"  id={p.pk} article={p.article!r} model_ifc={raw!r}")
            n += 1
            if n >= limit:
                break
        if n == 0:
            self.stdout.write("  (нет примеров)")

        self.stdout.write(self.style.MIGRATE_HEADING(".ifc в model_rfa (legacy — бейдж IFC должен гореть)"))
        n = 0
        for p in qs.exclude(model_rfa="").iterator(chunk_size=300):
            if not url_has_extension(p.model_rfa, ".ifc"):
                continue
            self.stdout.write(
                f"  id={p.pk} article={p.article!r} → backfill или пересохранить из FileAsset"
            )
            n += 1
            if n >= limit:
                break
        if n == 0:
            self.stdout.write("  (нет)")

    def _section_subcategory_hint(self, qs, limit: int) -> None:
        self.stdout.write(self.style.MIGRATE_HEADING("subcategory «стул»/«диван», категория другая (папка ≠ список)"))
        n = 0
        for p in qs.filter(
            Q(subcategory__icontains="стул")
            | Q(subcategory__icontains="диван")
            | Q(title__icontains="стул")
        ).iterator(chunk_size=200):
            sub = (p.subcategory or "").lower()
            cat = (p.category.name or "").lower()
            if "стул" in sub and "стул" not in cat:
                pass
            elif "диван" in sub and "диван" not in cat:
                pass
            else:
                continue
            self.stdout.write(
                f"  id={p.pk} category={p.category.name!r} subcategory={p.subcategory!r} article={p.article!r}"
            )
            n += 1
            if n >= limit:
                break
        if n == 0:
            self.stdout.write("  (нет примеров)")
