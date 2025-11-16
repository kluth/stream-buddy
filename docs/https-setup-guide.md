# HTTPS Development Setup Guide

## Why HTTPS is Required

Stream Buddy uses browser media APIs (`getUserMedia`, `getDisplayMedia`) to access your camera, microphone, and screen. Modern browsers **require HTTPS** for these APIs as a security measure.

### Secure Contexts

Browsers allow media access only in "secure contexts":
- ✅ `https://` URLs (with valid SSL certificate)
- ✅ `localhost` (exempt from HTTPS requirement)
- ✅ `127.0.0.1` (exempt from HTTPS requirement)
- ❌ `http://192.168.x.x` (local network IP over HTTP - **NOT allowed**)

**Problem:** Testing on mobile devices via local network IP requires HTTPS.

**Solution:** Use `mkcert` to generate locally-trusted SSL certificates.

---

## Quick Start

### Prerequisites
- Node.js 18+ and npm installed
- Stream Buddy repository cloned
- Terminal/Command Prompt access

### One-Command Setup

**macOS / Linux:**
```bash
npm run setup:https
```

**Windows:**
```powershell
npm run setup:https
```

This script will:
1. Check if mkcert is installed (prompt to install if missing)
2. Install a local Certificate Authority (CA) on your machine
3. Generate SSL certificate for localhost
4. Create `tls/` directory with certificate files

### Start HTTPS Dev Server

```bash
npm run start:https
```

Your app will be available at: **https://localhost:4200**

---

## Manual Setup (If Script Fails)

### Step 1: Install mkcert

**macOS (Homebrew):**
```bash
brew install mkcert
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install libnss3-tools
curl -s https://api.github.com/repos/FiloSottile/mkcert/releases/latest \
  | grep browser_download_url \
  | grep linux-amd64 \
  | cut -d '"' -f 4 \
  | wget -qi -
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

**Windows (Chocolatey):**
```powershell
choco install mkcert
```

**Windows (Manual Download):**
1. Download from: https://github.com/FiloSottile/mkcert/releases
2. Rename to `mkcert.exe`
3. Move to a directory in your PATH (e.g., `C:\Windows\System32`)

### Step 2: Install Local CA

```bash
mkcert -install
```

This installs a local Certificate Authority in your system trust store. Browsers will now trust certificates signed by this CA.

### Step 3: Generate Certificate

From the project root directory:

```bash
mkdir -p tls
mkcert -cert-file ./tls/localhost-cert.pem \
       -key-file ./tls/localhost-key.pem \
       -ecdsa \
       localhost 127.0.0.1 ::1
```

**What this does:**
- Creates `tls/` directory
- Generates ECDSA certificate (modern, smaller than RSA)
- Covers `localhost`, `127.0.0.1`, and `::1` (IPv6 loopback)

### Step 4: Verify Setup

Check that files exist:
```bash
ls -la tls/
```

You should see:
```
tls/
├── localhost-cert.pem
└── localhost-key.pem
```

### Step 5: Start Dev Server

```bash
npm run start:https
```

Visit **https://localhost:4200** - you should see a **secure** connection (green padlock in browser).

---

## Mobile Device Testing

To test on a mobile device via your local network IP:

### Step 1: Find Your Local IP Address

**macOS/Linux:**
```bash
ifconfig | grep "inet "
```

**Windows:**
```powershell
ipconfig
```

Look for an address like `192.168.1.100`.

### Step 2: Generate Certificate with Your IP

```bash
mkcert -cert-file ./tls/local-network-cert.pem \
       -key-file ./tls/local-network-key.pem \
       -ecdsa \
       localhost 192.168.1.100
```

Replace `192.168.1.100` with your actual IP.

### Step 3: Update angular.json

Edit `angular.json` to use the new certificate:

```json
{
  "configurations": {
    "https": {
      "sslCert": "./tls/local-network-cert.pem",
      "sslKey": "./tls/local-network-key.pem",
      "host": "0.0.0.0"
    }
  }
}
```

### Step 4: Install CA on Mobile Device

**iOS:**
1. Find the CA file: `$(mkcert -CAROOT)/rootCA.pem`
2. AirDrop it to your iPhone/iPad
3. Go to Settings → Profile Downloaded → Install
4. Go to Settings → General → About → Certificate Trust Settings
5. Enable full trust for the mkcert CA

**Android:**
1. Find the CA file: `$(mkcert -CAROOT)/rootCA.pem`
2. Transfer to device (email, USB, etc.)
3. Go to Settings → Security → Install from storage
4. Select the CA file
5. Name it "mkcert Development CA"

### Step 5: Access from Mobile

Start the server:
```bash
npm run start:https
```

On your mobile device, visit:
```
https://192.168.1.100:4200
```

(Replace with your actual IP)

---

## Troubleshooting

### "mkcert: command not found"

**Solution:** Install mkcert (see Step 1 above).

### Browser Shows "Not Secure" Warning

**Cause:** Local CA not installed or not trusted.

**Solution:**
1. Run `mkcert -install` again
2. Restart your browser
3. Check that CA is in system trust store:
   - macOS: Open Keychain Access → System → Find "mkcert"
   - Windows: Run `certmgr.msc` → Trusted Root CAs → Find "mkcert"
   - Linux: Check `~/.local/share/mkcert/rootCA.pem` exists

### Certificate Expired

**Cause:** mkcert certificates last 10 years, but system clock may be wrong.

**Solution:**
1. Check system date/time
2. Regenerate certificate: `mkcert localhost 127.0.0.1 ::1`

### "Address already in use" Error

**Cause:** Port 4200 is already in use.

**Solution:**
```bash
# Find process using port 4200
lsof -i :4200   # macOS/Linux
netstat -ano | findstr :4200   # Windows

# Kill the process or use a different port
ng serve --configuration=https --port=4201
```

### Mobile Device Shows "Cannot Connect"

**Checklist:**
- [ ] Firewall allows port 4200
- [ ] Mobile device on same Wi-Fi network
- [ ] Used correct local IP address
- [ ] Certificate includes the IP address (Step 2 above)
- [ ] CA installed on mobile device (Step 4 above)

---

## CI/CD Considerations

### GitHub Actions / GitLab CI

HTTPS setup is **NOT required** for CI/CD pipelines. CI runs unit tests and builds, which don't need media APIs.

**Recommendation:** Skip HTTPS setup in CI by checking for CI environment:

```bash
if [ -z "$CI" ]; then
  npm run setup:https
fi
```

### Docker

If running dev server in Docker:

1. Mount `tls/` directory as volume
2. Generate certificates on host machine
3. Or install mkcert in Dockerfile and run setup script

---

## Security Notes

### Safe Practices
- ✅ `tls/` directory is gitignored (private keys not committed)
- ✅ mkcert CA is only trusted on your machine
- ✅ Certificates are only valid for localhost/local IPs
- ✅ Production uses real SSL certificates (Let's Encrypt, AWS, etc.)

### What NOT to Do
- ❌ DO NOT commit `tls/` directory to version control
- ❌ DO NOT share your `rootCA-key.pem` file
- ❌ DO NOT use mkcert certificates in production
- ❌ DO NOT trust random CA certificates from the internet

### Uninstalling

To remove the local CA:

```bash
mkcert -uninstall
rm -rf tls/
```

---

## Additional Resources

- **mkcert GitHub**: https://github.com/FiloSottile/mkcert
- **Angular HTTPS Docs**: https://angular.dev/tools/cli/serve
- **MDN Secure Contexts**: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- **W3C MediaStream Spec**: https://www.w3.org/TR/mediacapture-streams/
