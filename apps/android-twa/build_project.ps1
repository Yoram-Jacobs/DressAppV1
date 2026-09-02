$ErrorActionPreference = "Stop"

# Get the script folder path and change to it
$scriptFolder = Split-Path -Parent $MyInvocation.MyCommand.Definition
cd $scriptFolder

# Clean up previously generated project directories to ensure clean update
$directoriesToClean = @("app", "gradle", "android-project")
foreach ($dir in $directoriesToClean) {
    if (Test-Path "./$dir") {
        Write-Host "Cleaning up existing ./$dir folder..."
        Remove-Item -Path "./$dir" -Recurse -Force
    }
}

# Clean up existing generated files
$filesToClean = @("android.keystore", "twa-manifest.json", "build.gradle", "settings.gradle")
foreach ($file in $filesToClean) {
    if (Test-Path "./$file") {
        Write-Host "Cleaning up existing $file..."
        Remove-Item -Path "./$file" -Force
    }
}

# Add JDK 17 bin directory to PATH so keytool can be found
$env:PATH = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\bin;" + $env:PATH

# 1. Generate the signing key in the current folder
Write-Host "Generating signing key using keytool..."
keytool -genkeypair `
  -dname "cn=DressApp Ops, ou=Ops, o=DressApp, c=US" `
  -alias "android" `
  -keypass "dressapp" `
  -keystore "android.keystore" `
  -storepass "dressapp" `
  -validity 20000 `
  -keyalg RSA `
  -keysize 2048

# 2. Write the twa-manifest.json file in the current folder
Write-Host "Writing twa-manifest.json..."
$twaManifestContent = @{
    packageId = "co.dressapp.twa"
    host = "dressapp.co"
    name = "DressApp"
    launcherName = "DressApp"
    display = "standalone"
    themeColor = "#1F6F6B"
    themeColorDark = "#1F6F6B"
    navigationColor = "#000000"
    navigationColorDark = "#000000"
    navigationDividerColor = "#000000"
    navigationDividerColorDark = "#000000"
    backgroundColor = "#F7F4EE"
    enableNotifications = $true
    startUrl = "/home"
    webManifestUrl = "https://dressapp.co/manifest.json"
    iconUrl = "https://dressapp.co/icon-512.png"
    maskableIconUrl = "https://dressapp.co/icon-512.png"
    monochromeIconUrl = ""
    appVersionName = "1.0.0"
    appVersion = "1.0.0"
    appVersionCode = 1
    signingKey = @{
        path = "android.keystore"
        alias = "android"
    }
    splashScreenFadeOutDuration = 300
    isChromeOSOnly = $false
    isMetaQuest = $false
    orientation = "portrait-primary"
    fallbackType = "customtabs"
    features = @{
        playBilling = $false
    }
    additionalTrustedOrigins = @()
    alphaMaskableThreshold = 100
} | ConvertTo-Json -Depth 5

# Use .NET WriteAllText to avoid any Byte Order Mark (BOM)
$manifestPath = Join-Path (Get-Location).Path "twa-manifest.json"
[System.IO.File]::WriteAllText($manifestPath, $twaManifestContent)

# 3. Run run_update.js to generate project files in the current folder
Write-Host "Running run_update.js..."
node run_update.js

Write-Host "Project updated successfully!"
