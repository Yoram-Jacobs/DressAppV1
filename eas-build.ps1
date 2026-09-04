<#
.SYNOPSIS
    eas-build.ps1 — EAS Build from a clean source-only workspace.

.DESCRIPTION
    Creates a 4.5 MB temp workspace with ONLY source files, then adds a
    Windows directory junction (node_modules -> real node_modules) so that
    `expo config` resolves plugins correctly, while .easignore excludes the
    junction from the EAS archive.

    Guaranteed archive contents: source files only (~4.5 MB).
    EAS server installs fresh Linux-native packages from yarn.lock.

.USAGE
    .\eas-build.ps1                          # development + android (default)
    .\eas-build.ps1 -Profile preview
    .\eas-build.ps1 -Profile production -Platform android
#>
param(
    [string]$Profile  = "development",
    [string]$Platform = "android"
)

$Root   = $PSScriptRoot
$TmpDir = Join-Path $env:TEMP "dressapp-eas-$(Get-Random)"

function Cleanup {
    if (Test-Path $TmpDir) {
        Write-Host "`n[eas-build] Removing temp workspace: $TmpDir" -ForegroundColor Cyan
        # Remove junctions first (must not recursively delete their targets)
        foreach ($j in @("node_modules", "apps\mobile\node_modules")) {
            $jp = Join-Path $TmpDir $j
            if (Test-Path $jp) {
                [System.IO.Directory]::Delete($jp, $false) | Out-Null
            }
        }
        Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
        Write-Host "[eas-build] Done." -ForegroundColor Green
    }
}
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup } | Out-Null

try {
    Write-Host "[eas-build] Creating clean workspace at $TmpDir ..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null

    # 1. Root config files
    foreach ($f in @("package.json","yarn.lock","turbo.json",".npmrc",".yarnrc",".yarnrc.yml")) {
        $src = Join-Path $Root $f
        if (Test-Path $src) { Copy-Item $src $TmpDir }
    }

    # 2. apps/mobile source (no node_modules, .expo, android, ios)
    Write-Host "[eas-build] Copying apps/mobile source..." -ForegroundColor Cyan
    $mobileDir = Join-Path $Root "apps\mobile"
    $mobileDst = Join-Path $TmpDir "apps\mobile"
    robocopy $mobileDir $mobileDst /E /XD "node_modules" ".expo" "android" "ios" "dist" "build" /NFL /NDL /NJH /NJS /NC /NS /NP 2>$null | Out-Null

    # 3. packages/* source only
    $pkgsDir = Join-Path $Root "packages"
    if (Test-Path $pkgsDir) {
        Write-Host "[eas-build] Copying packages/..." -ForegroundColor Cyan
        robocopy $pkgsDir (Join-Path $TmpDir "packages") /E /XD "node_modules" /NFL /NDL /NJH /NJS /NC /NS /NP 2>$null | Out-Null
    }

    # 4. Junctions: point both node_modules dirs to the real ones
    #    expo config uses process.cwd()-relative paths AND walks up the tree.
    #    Most packages are hoisted to the ROOT node_modules (Yarn workspace).
    #    We need BOTH junctions for expo's resolver to find all plugins.
    $rootNmJunction   = Join-Path $TmpDir "node_modules"
    $mobileNmJunction = Join-Path $mobileDst "node_modules"
    Write-Host "[eas-build] Creating junctions..." -ForegroundColor Cyan
    New-Item -ItemType Junction -Path $rootNmJunction   -Target (Join-Path $Root "node_modules")             | Out-Null
    New-Item -ItemType Junction -Path $mobileNmJunction -Target (Join-Path $Root "apps\mobile\node_modules") | Out-Null
    Write-Host "[eas-build]   tempdir/node_modules          -> root node_modules" -ForegroundColor Green
    Write-Host "[eas-build]   tempdir/apps/mobile/node_modules -> apps/mobile/node_modules" -ForegroundColor Green

    # 5. Report workspace size (junction not counted in size)
    $wsSizeMB = [math]::Round(((Get-ChildItem $TmpDir -Recurse -File -ErrorAction SilentlyContinue |
        Measure-Object Length -Sum).Sum / 1MB), 1)
    Write-Host "[eas-build] Source size: ${wsSizeMB} MB" -ForegroundColor Green
    Write-Host "[eas-build] node_modules junction created (excluded via .easignore)" -ForegroundColor Green

    # 5. Set up git repo in temp workspace (EAS requires git)
    #    Copy root .gitignore so junctions are ignored by git add
    $rootGitIgnore = Join-Path $Root ".gitignore"
    if (Test-Path $rootGitIgnore) {
        Copy-Item $rootGitIgnore $TmpDir
    } else {
        # Minimal gitignore to exclude the node_modules junctions
        Set-Content (Join-Path $TmpDir ".gitignore") "node_modules/`n.expo/`nandroid/`nios/"
    }
    # Suppress LF→CRLF warnings in the temp git repo
    Set-Content (Join-Path $TmpDir ".gitattributes") "* text=auto"
    Write-Host "[eas-build] Initializing git repo in temp workspace..." -ForegroundColor Cyan
    Push-Location $TmpDir
    git init --quiet
    git config core.autocrlf false
    git config user.email "eas-build@local"
    git config user.name "EAS Build"
    git add .
    git commit --quiet -m "eas build workspace"
    Pop-Location
    Write-Host "[eas-build] Git repo initialized with $(git -C $TmpDir diff --name-only HEAD | Measure-Object -Line | Select-Object -ExpandProperty Lines) files" -ForegroundColor Green

    # 6. Run EAS build
    $appDir = Join-Path $TmpDir "apps\mobile"
    Push-Location $appDir

    # Prevent EAS's git-casing check from walking above the temp dir and
    # finding an unrelated .git repo (e.g. at C:\Users\User\).
    # GIT_CEILING_DIRECTORIES stops git traversal at the specified path.
    $env:GIT_CEILING_DIRECTORIES = $env:TEMP
    $env:EAS_SKIP_AUTO_FINGERPRINT = "1"
    Write-Host "[eas-build] GIT_CEILING_DIRECTORIES -> $($env:TEMP)" -ForegroundColor Cyan

    Write-Host "[eas-build] Running: eas build --profile $Profile --platform $Platform`n" -ForegroundColor Yellow
    eas build --profile $Profile --platform $Platform --non-interactive --verbose-logs

} finally {
    Pop-Location -ErrorAction SilentlyContinue
    Cleanup
}
