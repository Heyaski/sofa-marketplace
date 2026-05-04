from django.urls import path
from .views import (
    UserMeView, 
    UserAvatarUploadView,
    RegisterView, 
    ChangePasswordView, 
    PasswordResetRequestView, 
    PasswordResetConfirmView,
    LogoutView,
    UserSearchView
)

urlpatterns = [
    path("me/", UserMeView.as_view(), name="user_me"),
    path("me/avatar/", UserAvatarUploadView.as_view(), name="user_avatar_upload"),
    path("search/", UserSearchView.as_view(), name="user_search"),
    path("register/", RegisterView.as_view(), name="user_register"),
    path("logout/", LogoutView.as_view(), name="user_logout"),
    path("me/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("reset-password/", PasswordResetRequestView.as_view(), name="reset-password"),
    path("reset-password-confirm/", PasswordResetConfirmView.as_view(), name="reset-password-confirm"),

]
