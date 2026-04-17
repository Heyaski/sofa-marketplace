from __future__ import annotations

import shlex
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from apps.catalog.models import Product


def _resolve_command_template() -> str:
    cmd = getattr(settings, "RFA_TO_GLB_COMMAND", "").strip()
    if not cmd:
        raise ValueError(
            "Не задана команда конвертации. Установите RFA_TO_GLB_COMMAND "
            "(например: python /opt/tools/rfa2glb.py --input {input} --output {output})"
        )
    if "{input}" not in cmd or "{output}" not in cmd:
        raise ValueError("RFA_TO_GLB_COMMAND должен содержать плейсхолдеры {input} и {output}.")
    return cmd


def _load_rfa_bytes(rfa_ref: str) -> bytes:
    if not rfa_ref:
        raise ValueError("Пустой путь к RFA.")
    if rfa_ref.startswith(("http://", "https://")):
        response = requests.get(rfa_ref, timeout=120)
        response.raise_for_status()
        return response.content
    file_name = rfa_ref.lstrip("/")
    with default_storage.open(file_name, "rb") as f:
        return f.read()


def _guess_source_name(rfa_ref: str) -> str:
    if rfa_ref.startswith(("http://", "https://")):
        parsed = urlparse(rfa_ref)
        name = Path(parsed.path).name
        return name or "source.rfa"
    return Path(rfa_ref).name or "source.rfa"


def convert_rfa_to_glb_for_product(product_id: int) -> str:
    product = Product.objects.get(pk=product_id)
    if not product.model_rfa:
        raise ValueError("У товара не указан model_rfa.")

    command_template = _resolve_command_template()
    rfa_bytes = _load_rfa_bytes(product.model_rfa)
    source_name = _guess_source_name(product.model_rfa)

    with tempfile.TemporaryDirectory(prefix=f"rfa2glb_{product_id}_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        in_name = source_name if source_name.lower().endswith(".rfa") else f"{source_name}.rfa"
        in_path = tmp_path / in_name
        out_path = tmp_path / "preview.glb"
        in_path.write_bytes(rfa_bytes)

        command = command_template.format(
            input=str(in_path),
            output=str(out_path),
            product_id=product_id,
            tmp_dir=str(tmp_path),
        )

        completed = subprocess.run(
            shlex.split(command),
            capture_output=True,
            text=True,
            timeout=getattr(settings, "RFA_CONVERT_TIMEOUT_SEC", 900),
        )
        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            stdout = (completed.stdout or "").strip()
            details = stderr or stdout or "unknown converter error"
            raise RuntimeError(f"Конвертер завершился с кодом {completed.returncode}: {details}")
        if not out_path.exists() or out_path.stat().st_size == 0:
            raise RuntimeError("Конвертация завершилась без выходного GLB файла.")

        target = f"products/{product_id}/rfa_preview.glb"
        with out_path.open("rb") as f:
            saved_path = default_storage.save(target, ContentFile(f.read()))
        return default_storage.url(saved_path)

