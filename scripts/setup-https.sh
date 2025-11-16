#!/bin/bash

#
# HTTPS Development Setup Script
# Stream Buddy - Angular Application
#
# This script:
# 1. Checks for mkcert installation
# 2. Installs local CA (if not already installed)
# 3. Generates SSL certificate for localhost
# 4. Creates tls/ directory structure
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TLS_DIR="./tls"
CERT_FILE="${TLS_DIR}/localhost-cert.pem"
KEY_FILE="${TLS_DIR}/localhost-key.pem"

echo "========================================="
echo "  Stream Buddy HTTPS Setup"
echo "========================================="
echo ""

# Step 1: Check for mkcert
echo "Checking for mkcert installation..."
if ! command -v mkcert &> /dev/null; then
    echo -e "${RED}ERROR: mkcert is not installed.${NC}"
    echo ""
    echo "Install mkcert:"
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  macOS:  brew install mkcert"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  Linux:  See https://github.com/FiloSottile/mkcert#installation"
    fi
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ mkcert is installed${NC}"
echo ""

# Step 2: Install local CA
echo "Installing local Certificate Authority..."
if mkcert -install; then
    echo -e "${GREEN}✓ Local CA installed successfully${NC}"
else
    echo -e "${YELLOW}⚠ CA may already be installed (this is OK)${NC}"
fi
echo ""

# Step 3: Create tls directory
echo "Creating tls/ directory..."
mkdir -p "${TLS_DIR}"
echo -e "${GREEN}✓ Directory created${NC}"
echo ""

# Step 4: Generate certificate
echo "Generating SSL certificate for localhost..."
if mkcert -cert-file "${CERT_FILE}" \
          -key-file "${KEY_FILE}" \
          -ecdsa \
          localhost 127.0.0.1 ::1; then
    echo -e "${GREEN}✓ Certificate generated successfully${NC}"
else
    echo -e "${RED}ERROR: Failed to generate certificate${NC}"
    exit 1
fi
echo ""

# Step 5: Verify files
echo "Verifying generated files..."
if [[ -f "${CERT_FILE}" ]] && [[ -f "${KEY_FILE}" ]]; then
    echo -e "${GREEN}✓ Certificate files created:${NC}"
    echo "  - ${CERT_FILE}"
    echo "  - ${KEY_FILE}"
else
    echo -e "${RED}ERROR: Certificate files not found${NC}"
    exit 1
fi
echo ""

# Step 6: Success message
echo "========================================="
echo -e "${GREEN}✓ HTTPS setup complete!${NC}"
echo "========================================="
echo ""
echo "You can now run the dev server with HTTPS:"
echo ""
echo -e "  ${YELLOW}npm run start:https${NC}"
echo "  or"
echo -e "  ${YELLOW}ng serve --configuration=https${NC}"
echo ""
echo "Your app will be available at:"
echo -e "  ${GREEN}https://localhost:4200${NC}"
echo ""
echo "Note: Certificate files are in tls/ and are gitignored."
echo ""
