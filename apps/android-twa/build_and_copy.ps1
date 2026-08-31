$ErrorActionPreference = "Stop"

# Get the script folder path
$scriptFolder = Split-Path -Parent $MyInvocation.MyCommand.Definition
cd $scriptFolder

Write-Host "1. Running build_project.ps1..."
.\build_project.ps1

Write-Host "2. Running run_build.js..."
node run_build.js

Write-Host "3. Locating built files..."
$fileAab = Get-ChildItem -Path C:\Users\User -Filter app-release-bundle.aab -Recurse -Force -ErrorAction SilentlyContinue | Select-Object -First 1
if ($fileAab) {
    Write-Host "Found AAB at: $($fileAab.FullName)"
    $destAab = Resolve-Path "..\app-release-bundle.aab" -ErrorAction SilentlyContinue
    if (-not $destAab) { $destAab = "..\app-release-bundle.aab" }
    Copy-Item -Path $fileAab.FullName -Destination $destAab -Force
    Write-Host "Copied AAB to $destAab"
} else {
    Write-Host "AAB not found!"
}

$fileApk = Get-ChildItem -Path C:\Users\User -Filter app-release-signed.apk -Recurse -Force -ErrorAction SilentlyContinue | Select-Object -First 1
if ($fileApk) {
    Write-Host "Found APK at: $($fileApk.FullName)"
    $destApk = Resolve-Path "..\app-release-signed.apk" -ErrorAction SilentlyContinue
    if (-not $destApk) { $destApk = "..\app-release-signed.apk" }
    Copy-Item -Path $fileApk.FullName -Destination $destApk -Force
    Write-Host "Copied APK to $destApk"
} else {
    Write-Host "APK not found!"
}

Write-Host "All steps completed successfully!"
