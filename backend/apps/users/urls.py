from django.urls import path
from .views import UserMeView, RegisterView, ChangePasswordView, PasswordResetRequestView, PasswordResetConfirmView

urlpatterns = [
    path("me/", UserMeView.as_view(), name="user_me"),
    path("register/", RegisterView.as_view(), name="user_register"),
    path("me/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("reset-password/", PasswordResetRequestView.as_view(), name="reset-password"),
    path("reset-password-confirm/", PasswordResetConfirmView.as_view(), name="reset-password-confirm"),

]
