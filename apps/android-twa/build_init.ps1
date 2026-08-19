$ErrorActionPreference = "Stop"

# Ensure android-project directory exists and is empty
if (Test-Path "./android-project") {
    Write-Host "Cleaning up existing android-project folder contents..."
    Get-ChildItem -Path "./android-project" -Force | Remove-Item -Recurse -Force
} else {
    Write-Host "Creating android-project folder..."
    New-Item -ItemType Directory -Path "./android-project" | Out-Null
}

# Define the inputs for the interactive prompts (excluding the directory creation question since it exists)
$inputs = @(
    "",              # Domain (dressapp.co)
    "",              # URL path (/home)
    "",              # Application name (DressApp)
    "",              # Short name (DressApp)
    "",              # Application ID (co.dressapp.twa)
    "",              # Starting version code (1)
    "",              # Display mode (standalone)
    "",              # Orientation (portrait-primary)
    "",              # Status bar color (#1F6F6B)
    "",              # Splash screen color (#F7F4EE)
    "",              # Icon URL (https://dressapp.co/icon-512.png)
    "",              # Maskable icon URL (https://dressapp.co/icon-512.png)
    "",              # Monochrome icon URL (none)
    "",              # Play Billing (No)
    "",              # Geolocation (No)
    "",              # Key store location (android.keystore)
    "",              # Key name (android)
    "Y",             # Create keystore (Yes)
    "DressApp Ops",  # First and Last names
    "Ops",           # Organizational Unit
    "DressApp",      # Organization
    "US",            # Country
    "CA",            # State
    "Los Angeles",   # City
    "dressapp",      # Password for the Key Store
    "dressapp"       # Password for the Key
)

# Join inputs using standard CRLF without any BOM
$inputString = ($inputs -join "`r`n") + "`r`n"

# Add JDK 17 bin directory to PATH so keytool can be found
$env:PATH = "C:\Program Files\Semeru\jdk-17.0.12.7-openj9\bin;" + $env:PATH

Write-Host "Running bubblewrap init..."
$inputString | node_modules\.bin\bubblewrap.cmd init --manifest=https://dressapp.co/manifest.json --directory=./android-project

Write-Host "Initialization completed successfully!"
