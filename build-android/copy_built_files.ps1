$destDir = "C:\DressApp_AG\build-android"

Write-Host "Searching for app-release-bundle.aab..."
$fileAab = Get-ChildItem -Path C:\Users\User -Filter app-release-bundle.aab -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($fileAab) {
    Write-Host "Found AAB at: $($fileAab.FullName) ($($fileAab.Length) bytes)"
    $destAab = Join-Path $destDir "app-release-bundle.aab"
    Copy-Item -Path $fileAab.FullName -Destination $destAab -Force
    Write-Host "AAB copied to $destAab"
} else {
    Write-Host "AAB not found!"
}

Write-Host "Searching for app-release-signed.apk..."
$fileApk = Get-ChildItem -Path C:\Users\User -Filter app-release-signed.apk -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($fileApk) {
    Write-Host "Found APK at: $($fileApk.FullName) ($($fileApk.Length) bytes)"
    $destApk = Join-Path $destDir "app-release-signed.apk"
    Copy-Item -Path $fileApk.FullName -Destination $destApk -Force
    Write-Host "APK copied to $destApk"
} else {
    Write-Host "APK not found!"
}

Write-Host "Copy process finished."
