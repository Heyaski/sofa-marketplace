from django.contrib import admin
from .models import Plan, Subscription
admin.site.register([Plan, Subscription])
