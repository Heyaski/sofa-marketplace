# Оптимизация GLB моделей: 60 MB → ~20 MB
# Использует gltfpack с -si 0.33 (упрощение до ~33% полигонов)
# Запуск: .\scripts\optimize-glb.ps1
# Или с другим коэффициентом: .\scripts\optimize-glb.ps1 -SiRatio 0.5
# Требуется: npm install -g gltfpack

param(
    [double]$SiRatio = 0.33
)

$ErrorActionPreference = "Stop"

# Проверка gltfpack
$gltfpack = $null
if (Get-Command gltfpack -ErrorAction SilentlyContinue) {
    $gltfpack = "gltfpack"
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    $gltfpack = "npx"
} else {
    Write-Host "Установите gltfpack: npm install -g gltfpack" -ForegroundColor Red
    exit 1
}
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$AssetsDir = Join-Path $ProjectRoot "backend\media\assets"
$BackupDir = Join-Path $ProjectRoot "backend\media\assets-backup"

if (-not (Test-Path $AssetsDir)) {
    Write-Host "Папка не найдена: $AssetsDir" -ForegroundColor Red
    exit 1
}

Write-Host "=== Оптимизация GLB (gltfpack -si $SiRatio) ===" -ForegroundColor Cyan
Write-Host "Папка: $AssetsDir"
Write-Host ""

# Бэкап при первом запуске
if (-not (Test-Path $BackupDir)) {
    Write-Host "Создаю бэкап в $BackupDir ..."
    Copy-Item -Path $AssetsDir -Destination $BackupDir -Recurse
    Write-Host "Бэкап создан."
    Write-Host ""
}

$glbFiles = Get-ChildItem -Path $AssetsDir -Include "*.glb","*.GLB" -File -ErrorAction SilentlyContinue
$count = 0

foreach ($f in $glbFiles) {
    $count++
    $sizeBefore = $f.Length
    $sizeMbBefore = [math]::Round($sizeBefore / 1MB, 1)
    
    Write-Host "[$count] $($f.Name) ($sizeMbBefore MB) ..."
    
    $tmpFile = "$($f.FullName).tmp"
    
    try {
        $args = if ($gltfpack -eq "npx") {
            @("gltfpack", "-i", $f.FullName, "-o", $tmpFile, "-si", $SiRatio)
        } else {
            @("-i", $f.FullName, "-o", $tmpFile, "-si", $SiRatio)
        }
        $proc = Start-Process -FilePath $gltfpack -ArgumentList $args -Wait -PassThru -NoNewWindow
        
        if ($proc.ExitCode -eq 0 -and (Test-Path $tmpFile)) {
            $sizeAfter = (Get-Item $tmpFile).Length
            $sizeMbAfter = [math]::Round($sizeAfter / 1MB, 1)
            Move-Item -Path $tmpFile -Destination $f.FullName -Force
            Write-Host "    -> $sizeMbAfter MB (было $sizeMbBefore MB)" -ForegroundColor Green
        } else {
            if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force }
            Write-Host "    ОШИБКА: gltfpack не сработал (код $($proc.ExitCode))" -ForegroundColor Red
        }
    } catch {
        if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
        Write-Host "    ОШИБКА: $_" -ForegroundColor Red
    }
    Write-Host ""
}

if ($count -eq 0) {
    Write-Host "GLB файлы не найдены."
} else {
    Write-Host "Готово. Обработано файлов: $count" -ForegroundColor Cyan
}
