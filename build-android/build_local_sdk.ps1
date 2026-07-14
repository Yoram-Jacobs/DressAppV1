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
    $dest = "C:\DressApp_AG\build-android\app-release-bundle.aab"
    Copy-Item -Path $fileAab.FullName -Destination $dest -Force
    Write-Host "Copied AAB to $dest"
} else {
    Write-Host "AAB not found!"
}

$fileApk = Get-ChildItem -Path C:\Users\User -Filter app-release-signed.apk -Recurse -Force -ErrorAction SilentlyContinue | Select-Object -First 1
if ($fileApk) {
    Write-Host "Found APK at: $($fileApk.FullName)"
    $dest = "C:\DressApp_AG\build-android\app-release-signed.apk"
    Copy-Item -Path $fileApk.FullName -Destination $dest -Force
    Write-Host "Copied APK to $dest"
} else {
    Write-Host "APK not found!"
}

Write-Host "All steps completed successfully!"
