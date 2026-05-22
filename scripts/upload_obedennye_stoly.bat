@echo off
setlocal
set "ZIP=c:\Users\anton\Downloads\Telegram Desktop\Обеденные столы_2615_3399_3формы.zip"
set "SCRIPT=%~dp0upload_zip_to_models.ps1"

if not exist "%ZIP%" (
  echo ZIP not found:
  echo   %ZIP%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" ^
  -ZipPath "%ZIP%" ^
  -ServerHost "45.12.74.57" ^
  -User "upload3d" ^
  -Port 22 ^
  -RemoteDir "/models" ^
  -KeyPath "%USERPROFILE%\.ssh\upload3d_ed25519"

if errorlevel 1 (
  echo.
  echo Upload failed. Put private key here: %USERPROFILE%\.ssh\upload3d_ed25519
  echo Or copy from server: scp deploy@45.12.74.57:/home/deploy/.ssh/upload3d_ed25519 %%USERPROFILE%%\.ssh\
  pause
  exit /b 1
)

echo Done: 6 files unpacked and uploaded to /models
pause
