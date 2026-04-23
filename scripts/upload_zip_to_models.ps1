param(
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,

    [string]$ServerHost = "45.12.74.57",
    [int]$Port = 22,
    [string]$User = "upload3d",
    [string]$RemoteDir = "/models",
    [string]$KeyPath = "$env:USERPROFILE\.ssh\upload3d_ed25519"
)

$ErrorActionPreference = "Stop"

function Assert-Tool($toolName) {
    $cmd = Get-Command $toolName -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "Required tool '$toolName' is not found in PATH."
    }
}

Assert-Tool "sftp"
Assert-Tool "ssh"

$zipFullPath = (Resolve-Path -LiteralPath $ZipPath).Path
if (-not (Test-Path -LiteralPath $zipFullPath)) {
    throw "ZIP not found: $ZipPath"
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
    throw "SSH key not found: $KeyPath"
}

$extractDir = Join-Path $env:TEMP ("models_zip_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $extractDir | Out-Null

try {
    Write-Host "Extracting ZIP: $zipFullPath"
    Expand-Archive -LiteralPath $zipFullPath -DestinationPath $extractDir -Force

    $files = Get-ChildItem -LiteralPath $extractDir -Recurse -File
    if (-not $files -or $files.Count -eq 0) {
        throw "No files found inside ZIP."
    }

    $batchPath = Join-Path $extractDir "sftp_batch.txt"
    $batchLines = New-Object System.Collections.Generic.List[string]

    # Ensure destination exists and switch to it.
    $batchLines.Add("mkdir `"$RemoteDir`"")
    $batchLines.Add("cd `"$RemoteDir`"")

    foreach ($file in $files) {
        # Upload only explicitly allowed model/preview formats.
        $ext = $file.Extension.ToLowerInvariant()
        if ($ext -in @(".glb", ".rfa", ".ofc", ".png", ".jpg", ".jpeg")) {
            $batchLines.Add("put `"$($file.FullName)`"")
        }
    }

    if ($batchLines.Count -le 2) {
        throw "No supported files for upload found in ZIP."
    }

    Set-Content -LiteralPath $batchPath -Value $batchLines -Encoding UTF8

    Write-Host ("Uploading files to {0}@{1}:{2} ..." -f $User, $ServerHost, $RemoteDir)
    & sftp -i $KeyPath -P $Port -b $batchPath "$User@$ServerHost"
    if ($LASTEXITCODE -ne 0) {
        throw "SFTP upload failed with exit code $LASTEXITCODE."
    }

    Write-Host "Upload completed successfully."
}
finally {
    if (Test-Path -LiteralPath $extractDir) {
        Remove-Item -LiteralPath $extractDir -Recurse -Force
    }
}
