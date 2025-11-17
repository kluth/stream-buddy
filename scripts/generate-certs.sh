#!/bin/bash

set -e

echo "Generating self-signed SSL certificates for MediaMTX WebRTC..."

# Generate self-signed certificates for MediaMTX WebRTC
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt \
  -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=StreamBuddy/CN=localhost"

echo ""
echo "Certificates generated successfully:"
echo "  - server.key (private key)"
echo "  - server.crt (certificate)"
echo ""
echo "These files are required for MediaMTX WebRTC functionality."
echo "For production, replace with Let's Encrypt certificates."
