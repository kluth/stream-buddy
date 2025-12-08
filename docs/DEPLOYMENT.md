# Broadboi Production Deployment Guide

## 1. Introduction

This guide provides comprehensive instructions for deploying Broadboi to a production environment. Broadboi is composed of three main services:

1.  **Angular Frontend:** The user interface, built with Angular and served as static assets.
2.  **NestJS Backend (BFF):** A Node.js backend-for-frontend service handling authentication, API calls, and coordinating MediaMTX.
3.  **MediaMTX Server:** A real-time media server for WebRTC ingestion and RTMP output.

The recommended deployment architecture uses Docker/Docker Compose for MediaMTX, a Node.js process manager (like PM2) for the backend, and Nginx as a reverse proxy for both the backend API and serving the frontend static assets, handling SSL termination.

## 2. Prerequisites

Ensure your production server (e.g., a Linux VM or dedicated server) has the following installed:

*   **Docker Engine & Docker Compose:** For running MediaMTX.
    *   [Install Docker](https://docs.docker.com/engine/install/)
    *   [Install Docker Compose](https://docs.docker.com/compose/install/)
*   **Node.js & npm/yarn:** For building the Angular frontend and running the NestJS backend.
    *   Recommended Node.js LTS version (e.g., v20.x).
*   **Nginx:** As a reverse proxy and static file server.
    *   [Install Nginx](https://www.nginx.com/resources/wiki/start/topics/tutorials/install/)
*   **Certbot:** For automating Let's Encrypt SSL certificates.
    *   [Install Certbot](https://certbot.eff.org/instructions)
*   **PM2 (optional but recommended):** A production process manager for Node.js applications.
    *   `npm install -g pm2` or `yarn global add pm2`
*   **Git:** For cloning the repository.
    *   `sudo apt install git` (Ubuntu/Debian)

## 3. Building Production Artifacts

First, clone your project repository to your production server and navigate into the project directory.

```bash
git clone <your-repo-url>
cd broadboi
npm install # or yarn install
```

### 3.1. Frontend (Angular)

Build the Angular application for production. This will generate optimized static files.

```bash
npx nx build broadboi --configuration=production
```

The output will be in `dist/apps/broadboi/browser`.

### 3.2. Backend (NestJS)

Build the NestJS backend application for production.

```bash
npx nx build api --configuration=production
```

The output will be in `dist/apps/api`.

## 4. Environment Configuration & Secrets Management

Securely manage sensitive information. **Never hardcode secrets.** Use environment variables or a dedicated secrets management solution (e.g., Docker Secrets, Kubernetes Secrets, HashiCorp Vault).

Create a `.env` file in the root of the backend application (`dist/apps/api/.env` if `NODE_ENV=production`) or ensure your process manager loads them.

### Required Environment Variables:

*   **`NODE_ENV`**: `production`
*   **`PORT`**: Port for the backend (e.g., `3000`).
*   **`FRONTEND_URL`**: Your production frontend URL (e.g., `https://stream.example.com`).
*   **`YOUTUBE_CLIENT_ID`**: Google OAuth Client ID.
*   **`YOUTUBE_CLIENT_SECRET`**: Google OAuth Client Secret.
*   **`YOUTUBE_REDIRECT_URI`**: `https://api.stream.example.com/api/auth/youtube/callback` (adjust domain).
*   **`TWITCH_CLIENT_ID`**: Twitch OAuth Client ID.
*   **`TWITCH_CLIENT_SECRET`**: Twitch OAuth Client Secret.
*   **`TWITCH_REDIRECT_URI`**: `https://api.stream.example.com/api/auth/twitch/callback` (adjust domain).
*   **`SENTRY_DSN`**: Your Sentry DSN for backend error tracking.
*   **`SENTRY_DSN_FRONTEND`**: Your Sentry DSN for frontend error tracking (this will be injected into Angular build).

**Example `.env` (for backend):**

```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://stream.example.com
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=https://api.stream.example.com/api/auth/youtube/callback
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=https://api.stream.example.com/api/auth/twitch/callback
SENTRY_DSN=https://your-backend-sentry-dsn
```

For the **Angular frontend**, the `SENTRY_DSN` must be configured during the build process via `apps/broadboi/src/environments/environment.prod.ts`. Replace `sentryDsn` with your production DSN.

## 5. MediaMTX Deployment

MediaMTX runs in a Docker container, managed by Docker Compose.

1.  **Create SSL Certificates:** MediaMTX requires SSL certificates for WebRTC connections (even behind a proxy). Use a valid certificate from Let's Encrypt or similar.
    *   Place `server.key` and `server.crt` in the root of your project directory or adjust `docker-compose.yml` accordingly.
2.  **Configure `mediamtx.yml`:**
    *   Review `mediamtx.yml` in the project root.
    *   **Crucially**, update `webrtcAllowOrigin` from `'*'` to your production frontend domain (e.g., `https://stream.example.com`).
    *   Ensure `webrtcServerKey` and `webrtcServerCert` point to your SSL certificates.
3.  **Run MediaMTX:**
    ```bash
    docker-compose -f docker-compose.yml up -d mediamtx
    ```
    Verify it's running: `docker-compose ps`

## 6. Backend (NestJS) Deployment

The backend should be run using a process manager like PM2 to ensure it restarts automatically and manages logs.

1.  **Navigate to Backend Build Directory:**
    ```bash
    cd dist/apps/api
    ```
2.  **Start with PM2:**
    ```bash
    pm2 start main.js --name "broadboi-api"
    pm2 save
    ```
    This will start the Node.js server. `pm2 save` saves the current process list to be restored on server reboot.
3.  **Ensure Environment Variables are Loaded:** PM2 can load environment variables from a `.env` file or you can pass them directly.

## 7. Frontend (Angular) Deployment with Nginx

The Angular frontend is served as static files. Nginx will serve these files and act as a reverse proxy for the backend API.

1.  **Copy Frontend Assets:**
    Copy the built Angular assets from `dist/apps/broadboi/browser` to a serving directory (e.g., `/var/www/broadboi-frontend`).
    ```bash
    sudo mkdir -p /var/www/broadboi-frontend
    sudo cp -r /home/matthias/projects/broadboi/dist/apps/broadboi/browser/* /var/www/broadboi-frontend/
    ```
2.  **Nginx Configuration:**
    Create an Nginx server block configuration file (e.g., `/etc/nginx/sites-available/broadboi.conf`) for your frontend and backend API.

    ```nginx
    server {
        listen 80;
        listen [::]:80;
        server_name stream.example.com api.stream.example.com; # Your domain(s)

        # Redirect HTTP to HTTPS
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name stream.example.com; # Frontend domain

        ssl_certificate /etc/letsencrypt/live/stream.example.com/fullchain.pem; # Managed by Certbot
        ssl_certificate_key /etc/letsencrypt/live/stream.example.com/privkey.pem; # Managed by Certbot

        # Frontend static files
        root /var/www/broadboi-frontend;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # Proxy API requests to backend BFF
        location /api/ {
            proxy_pass http://localhost:3000; # Or your backend server's IP/port
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name api.stream.example.com; # Backend API domain

        ssl_certificate /etc/letsencrypt/live/api.stream.example.com/fullchain.pem; # Managed by Certbot
        ssl_certificate_key /etc/letsencrypt/live/api.stream.example.com/privkey.pem; # Managed by Certbot

        location /api/ {
            proxy_pass http://localhost:3000; # Or your backend server's IP/port
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    ```
    *   **Enable the configuration:** `sudo ln -s /etc/nginx/sites-available/broadboi.conf /etc/nginx/sites-enabled/`
    *   **Test Nginx config:** `sudo nginx -t`
    *   **Reload Nginx:** `sudo systemctl reload nginx`

## 8. SSL Certificate Setup (Let's Encrypt with Certbot)

It is crucial to use HTTPS in production. Certbot automates this for Let's Encrypt certificates.

1.  **Ensure Nginx is running and configured for HTTP (port 80) for domain validation.**
2.  **Run Certbot:**
    ```bash
    sudo certbot --nginx -d stream.example.com -d api.stream.example.com
    ```
    Follow the prompts. Certbot will automatically configure Nginx for HTTPS.
3.  **Verify automatic renewal:** `sudo systemctl status certbot.timer`

## 9. Firewall Configuration

Configure your server's firewall (e.g., `ufw` on Linux) to allow necessary traffic.

```bash
sudo ufw allow 'Nginx Full'         # For HTTP (80) and HTTPS (443)
sudo ufw allow 8889/tcp             # MediaMTX WebRTC (WHIP)
sudo ufw allow 8889/udp             # MediaMTX WebRTC (WHIP)
sudo ufw allow 1935/tcp             # MediaMTX RTMP
sudo ufw allow 9997/tcp             # MediaMTX API (restrict to localhost or trusted IPs in prod)
sudo ufw enable                     # Enable firewall
```

## 10. OAuth Application Setup

For Twitch and YouTube authentication, you must register your application with their respective developer consoles and configure the production redirect URIs.

*   **Twitch Developers:** [https://dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
    *   Add `https://api.stream.example.com/api/auth/twitch/callback` as a valid OAuth Redirect URL.
*   **Google Cloud Console (for YouTube):** [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
    *   Configure your OAuth 2.0 Client ID with `https://api.stream.example.com/api/auth/youtube/callback` as an authorized redirect URI.

## 11. Monitoring and Logging

*   **Sentry:** Ensure your production `SENTRY_DSN` values are set for both frontend and backend. Monitor Sentry for errors and performance issues.
*   **System Logs:** Monitor `pm2 logs broadboi-api` for backend, `journalctl -u nginx` for Nginx, and `docker-compose logs mediamtx` for MediaMTX.
*   **MediaMTX Metrics API:** `curl http://localhost:9997/v3/metrics | jq` provides real-time internal metrics.

## 12. Backup and Disaster Recovery

*   **Codebase:** Keep your Git repository up-to-date.
*   **Data:** If using a database (not currently implemented, but for future), implement regular database backups.
*   **Configuration:** Back up Nginx configuration, Docker Compose files, and `.env` files.
*   **Sentry:** Store Sentry DSNs and API keys securely.

## 13. Deployment Checklist

Before going live, ensure all points are checked:

*   [ ] All required environment variables are set for backend.
*   [ ] Frontend `environment.prod.ts` has correct `sentryDsn`.
*   [ ] MediaMTX `webrtcAllowOrigin` is set to production domain.
*   [ ] Production SSL certificates are configured.
*   [ ] Nginx is configured, enabled, and reloaded.
*   [ ] Firewall is correctly configured.
*   [ ] OAuth application redirect URIs are updated on Twitch/Google.
*   [ ] All services are running (MediaMTX, backend, Nginx).
*   [ ] Test critical user flows in production.
*   [ ] Sentry is receiving errors and performance data.

---
**Document Version**: 1.0.0
**Last Updated**: 2025-11-30
**Maintained By**: Broadboi Development Team
