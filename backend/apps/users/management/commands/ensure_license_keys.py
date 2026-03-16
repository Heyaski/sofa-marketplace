"""
Генерирует license_key_hash для пользователей с trial/basic/pro/premium, у которых его ещё нет.
Запуск: python manage.py ensure_license_keys
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.users.models import UserProfile


class Command(BaseCommand):
    help = 'Генерирует license_key_hash для профилей с подпиской, у которых его нет'

    def handle(self, *args, **options):
        qs = UserProfile.objects.filter(
            subscription_type__in=('basic', 'pro', 'premium')
        ).filter(Q(license_key_hash__isnull=True) | Q(license_key_hash=''))
        count = 0
        for profile in qs:
            if profile.ensure_license_key_hash():
                profile.save(update_fields=['license_key_hash'])
                count += 1
                self.stdout.write(f'  {profile.user.username} ({profile.subscription_type})')
        self.stdout.write(self.style.SUCCESS(f'Сгенерировано ключей: {count}'))
