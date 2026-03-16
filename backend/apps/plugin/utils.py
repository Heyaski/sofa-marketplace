"""Утилиты для API плагина: разрешение URL файлов GLB/RFA."""
from django.conf import settings


def get_file_asset_url(asset, request=None):
    """Возвращает URL файла из FileAsset (поддержка S3 signed URLs)."""
    if not asset or not asset.file:
        return None
    if not hasattr(asset.file, 'url'):
        return None

    use_signed_urls = getattr(settings, 'S3_FILE_ACCESS_MODE', 'public') == 'signed'

    if use_signed_urls:
        try:
            import boto3
            from botocore.client import Config

            endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', None)
            aws_access_key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
            aws_secret_access_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
            bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)

            if not all([endpoint_url, aws_access_key_id, aws_secret_access_key, bucket_name]):
                raise ValueError("S3 settings missing")

            region_for_signature = getattr(settings, 'AWS_S3_REGION_NAME_FOR_SIGNING', None)
            if not region_for_signature:
                if 'ru1' in str(endpoint_url).lower():
                    region_for_signature = 'ru1'
                else:
                    region_for_signature = 'us-east-1'

            s3_client = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
                region_name=region_for_signature,
                config=Config(s3={'addressing_style': 'path'}),
            )

            file_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': asset.file.name},
                ExpiresIn=3600,
            )
            if f'/{bucket_name}/{bucket_name}/' in file_url:
                file_url = file_url.replace(f'/{bucket_name}/{bucket_name}/', f'/{bucket_name}/')
            return file_url
        except Exception:
            if hasattr(asset.file, 'storage') and hasattr(asset.file.storage, 'url'):
                try:
                    return asset.file.storage.url(asset.file.name)
                except Exception:
                    pass
            file_url = asset.file.url
    else:
        file_url = asset.file.url

    if file_url.startswith(('http://', 'https://')):
        return file_url
    return request.build_absolute_uri(file_url) if request else file_url


def resolve_product_file_url(product, fmt, request):
    """
    Возвращает URL файла GLB или RFA для товара.
    fmt: '.glb' или '.rfa'
    """
    ext = fmt.lower() if fmt.startswith('.') else f'.{fmt}'.lower()

    # 1. Прямые URL в Product
    if ext == '.rfa' and product.model_rfa:
        url = product.model_rfa
        if url.startswith(('http://', 'https://')):
            return url
        return request.build_absolute_uri(url)

    if ext == '.glb' and product.model_glb:
        url = product.model_glb
        if url.startswith(('http://', 'https://')):
            return url
        return request.build_absolute_uri(url)

    # 2. FileAsset
    assets = product.get_3d_model_assets()
    for asset in assets:
        if not asset.file or not asset.file.name:
            continue
        name_lower = asset.file.name.lower()
        if ext == '.rfa' and name_lower.endswith('.rfa'):
            return get_file_asset_url(asset, request)
        if ext == '.glb' and (name_lower.endswith('.glb') or name_lower.endswith('.gltf')):
            return get_file_asset_url(asset, request)

    return None
