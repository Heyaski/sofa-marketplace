@echo off
setlocal

if "%~1"=="" (
  echo Drag-and-drop a ZIP file onto this .bat file.
  echo.
  echo Example:
  echo   upload_zip_to_models.bat "C:\Users\You\Downloads\models.zip"
  pause
  exit /b 1
)

set "ZIP_PATH=%~1"
set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%upload_zip_to_models.ps1"

if not exist "%PS_SCRIPT%" (
  echo PowerShell script not found: "%PS_SCRIPT%"
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" ^
  -ZipPath "%ZIP_PATH%" ^
  -ServerHost "45.12.74.57" ^
  -User "upload3d" ^
  -Port 22 ^
  -RemoteDir "/models" ^
  -KeyPath "%USERPROFILE%\.ssh\upload3d_ed25519"

if errorlevel 1 (
  echo.
  echo Upload failed.
  pause
  exit /b 1
)

echo.
echo Upload completed successfully.
pause
exit /b 0
