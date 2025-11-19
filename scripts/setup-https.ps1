#
# HTTPS Development Setup Script - Windows
# Stream Buddy - Angular Application
#
# This script:
# 1. Checks for mkcert installation
# 2. Installs local CA (if not already installed)
# 3. Generates SSL certificate for localhost
# 4. Creates tls/ directory structure
#

# Stop on errors
$ErrorActionPreference = "Stop"

# Configuration
$TLS_DIR = "./tls"
$CERT_FILE = "$TLS_DIR/localhost-cert.pem"
$KEY_FILE = "$TLS_DIR/localhost-key.pem"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Stream Buddy HTTPS Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check for mkcert
Write-Host "Checking for mkcert installation..."
try {
    $mkcertVersion = & mkcert -version 2>&1
    Write-Host "✓ mkcert is installed" -ForegroundColor Green
} catch {
    Write-Host "ERROR: mkcert is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install mkcert using Chocolatey:" -ForegroundColor Yellow
    Write-Host "  choco install mkcert" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or download from:" -ForegroundColor Yellow
    Write-Host "  https://github.com/FiloSottile/mkcert/releases" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host ""

# Step 2: Install local CA
Write-Host "Installing local Certificate Authority..."
try {
    & mkcert -install
    Write-Host "✓ Local CA installed successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠ CA may already be installed (this is OK)" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Create tls directory
Write-Host "Creating tls/ directory..."
if (-not (Test-Path -Path $TLS_DIR)) {
    New-Item -ItemType Directory -Path $TLS_DIR | Out-Null
}
Write-Host "✓ Directory created" -ForegroundColor Green
Write-Host ""

# Step 4: Generate certificate
Write-Host "Generating SSL certificate for localhost..."
try {
    & mkcert -cert-file $CERT_FILE -key-file $KEY_FILE -ecdsa localhost 127.0.0.1 ::1
    Write-Host "✓ Certificate generated successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to generate certificate" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Verify files
Write-Host "Verifying generated files..."
if ((Test-Path $CERT_FILE) -and (Test-Path $KEY_FILE)) {
    Write-Host "✓ Certificate files created:" -ForegroundColor Green
    Write-Host "  - $CERT_FILE"
    Write-Host "  - $KEY_FILE"
} else {
    Write-Host "ERROR: Certificate files not found" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Success message
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✓ HTTPS setup complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now run the dev server with HTTPS:"
Write-Host ""
Write-Host "  npm run start:https" -ForegroundColor Yellow
Write-Host "  or"
Write-Host "  ng serve --configuration=https" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your app will be available at:"
Write-Host "  https://localhost:4200" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Certificate files are in tls/ and are gitignored."
Write-Host ""
