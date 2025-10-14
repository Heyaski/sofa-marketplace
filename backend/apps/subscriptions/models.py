from django.db import models
from django.contrib.auth.models import User
from datetime import timedelta
from django.utils.timezone import now


class Plan(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    duration_days = models.PositiveIntegerField(default=30)

    def __str__(self):
        return self.name


class Subscription(models.Model):
    user = models.ForeignKey(User, related_name="subscriptions", on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE)
    start_date = models.DateTimeField(default=now)
    end_date = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.end_date:
            self.end_date = self.start_date + timedelta(days=self.plan.duration_days)
        super().save(*args, **kwargs)

    def is_active(self):
        return self.end_date >= now()

    def __str__(self):
        return f"{self.user.username} - {self.plan.name}"
