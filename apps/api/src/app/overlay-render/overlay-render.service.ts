import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OverlayConfigEntity } from '../core/entities/overlay-config.entity';
import {
  OverlayElement,
  TextOverlayElement,
  ImageOverlayElement,
  VideoOverlayElement,
  WebOverlayElement,
  ChatOverlayElement,
  AlertOverlayElement,
} from '@broadboi/core/lib/models/overlay.types';

/**
 * HTML entity map for escaping special characters to prevent XSS attacks.
 * These characters are replaced with their HTML entity equivalents.
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

@Injectable()
export class OverlayRenderService {
  private readonly logger = new Logger(OverlayRenderService.name);
  private readonly WEBSOCKET_URL = 'http://localhost:3000'; // Frontend's WebSocket URL

  /**
   * Escapes HTML special characters to prevent XSS attacks.
   * This function should be used for ALL user-provided content before
   * inserting into HTML.
   *
   * @param unsafe The potentially unsafe string to escape
   * @returns The escaped string safe for HTML insertion
   */
  private escapeHtml(unsafe: string | undefined | null): string {
    if (unsafe === undefined || unsafe === null) {
      return '';
    }
    return String(unsafe).replace(/[&<>"'`=\/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
  }

  /**
   * Escapes a string for safe use in JavaScript string literals.
   * Prevents injection attacks in dynamically generated JavaScript.
   *
   * @param unsafe The potentially unsafe string to escape
   * @returns The escaped string safe for JavaScript string literals
   */
  private escapeJsString(unsafe: string | undefined | null): string {
    if (unsafe === undefined || unsafe === null) {
      return '';
    }
    return String(unsafe)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e');
  }

  /**
   * Validates and sanitizes a URL to prevent javascript: and data: URI attacks.
   * Only allows http:, https:, and relative URLs.
   *
   * @param url The URL to validate
   * @returns The sanitized URL or an empty string if invalid
   */
  private sanitizeUrl(url: string | undefined | null): string {
    if (url === undefined || url === null) {
      return '';
    }
    const trimmedUrl = String(url).trim();

    // Block javascript:, data:, vbscript: and other dangerous protocols
    const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
    if (dangerousProtocols.test(trimmedUrl)) {
      this.logger.warn(`Blocked potentially dangerous URL: ${trimmedUrl.substring(0, 50)}...`);
      return '';
    }

    // Allow only http, https, and relative URLs
    if (trimmedUrl.startsWith('http://') ||
        trimmedUrl.startsWith('https://') ||
        trimmedUrl.startsWith('/') ||
        trimmedUrl.startsWith('./') ||
        !trimmedUrl.includes(':')) {
      return this.escapeHtml(trimmedUrl);
    }

    this.logger.warn(`Blocked URL with unknown protocol: ${trimmedUrl.substring(0, 50)}...`);
    return '';
  }

  constructor(
    @InjectRepository(OverlayConfigEntity)
    private overlayConfigRepository: Repository<OverlayConfigEntity>,
  ) {}

  async saveOverlayConfig(internalUserId: string, overlayName: string, config: OverlayElement[]): Promise<void> {
    this.logger.log(`Saving overlay configuration "${overlayName}" for user: ${internalUserId}`);
    try {
      let overlayConfigEntity = await this.overlayConfigRepository.findOne({ where: { internalUserId, name: overlayName } });

      if (!overlayConfigEntity) {
        overlayConfigEntity = this.overlayConfigRepository.create({
          internalUserId,
          name: overlayName,
          config: config,
        });
      } else {
        overlayConfigEntity.config = config;
      }
      await this.overlayConfigRepository.save(overlayConfigEntity);
      this.logger.log(`Overlay configuration "${overlayName}" saved/updated for user: ${internalUserId}`);
    } catch (error) {
      this.logger.error(`Failed to save overlay configuration "${overlayName}" for user ${internalUserId}: ${error.message}`);
      throw error; // Re-throw the error after logging
    }
  }

  async getOverlayConfig(internalUserId: string, overlayName: string): Promise<OverlayElement[] | undefined> {
    this.logger.log(`Retrieving overlay configuration "${overlayName}" for user: ${internalUserId}`);
    try {
      const overlayConfigEntity = await this.overlayConfigRepository.findOne({ where: { internalUserId, name: overlayName } });
      return overlayConfigEntity ? overlayConfigEntity.config : undefined;
    } catch (error) {
      this.logger.error(`Failed to retrieve overlay configuration "${overlayName}" for user ${internalUserId}: ${error.message}`);
      return undefined; // Return undefined on retrieval failure
    }
  }

  /**
   * Generates a full HTML page for a stream overlay browser source.
   * @param {string} internalUserId - The internal user ID for whom to render the overlay.
   * @param {string} overlayName - The name of the overlay to render.
   * @returns {Promise<string>} The full HTML string.
   */
  async generateOverlayHtml(internalUserId: string, overlayName: string): Promise<string> {
    const overlayConfig = (await this.getOverlayConfig(internalUserId, overlayName)) || this.getDefaultOverlayConfig();
    
    const elementsHtml = this.renderOverlayElements(overlayConfig);
    const elementsCss = this.generateCss(overlayConfig);
    const elementsJs = this.generateJavascript(overlayConfig, internalUserId);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Broadboi Overlay</title>
          <style>
              body {
                  margin: 0;
                  overflow: hidden; /* Prevent scrollbars */
                  background-color: transparent; /* Essential for OBS */
                  font-family: sans-serif;
              }
              .overlay-element {
                  position: absolute;
                  box-sizing: border-box;
              }
              /* Base styling for element types */
              .overlay-element.text { /* Specific styles handled by JS */ }
              .overlay-element.image img { width: 100%; height: 100%; object-fit: contain; }
              .overlay-element.video { background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; }
              .overlay-element.web { background-color: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; }
              .overlay-element.chat { overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
              .overlay-element.chat .chat-message { padding: 2px 5px; margin-top: 2px; }
              .overlay-element.alert {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                background-color: rgba(255, 255, 0, 0.7); /* Default alert background */
                color: black;
                text-align: center;
              }
              .overlay-element.alert img { max-width: 80%; max-height: 80%; object-fit: contain; }

              /* Custom CSS generated from element properties */
              ${elementsCss}
          </style>
          <!-- Socket.IO client library -->
          <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
      </head>
      <body>
          <div id="overlay-root" style="position: relative; width: 1920px; height: 1080px;">
              ${elementsHtml}
          </div>

          <script>
              // Overlay elements data for JavaScript processing
              window.overlayElements = ${JSON.stringify(overlayConfig)};
              window.internalUserId = '${internalUserId}';
              window.WEBSOCKET_URL = '${this.WEBSOCKET_URL}';
          </script>
          ${elementsJs}
      </body>
      </html>
    `;
  }

  private renderOverlayElements(overlayConfig: OverlayElement[]): string {
    return overlayConfig
      .filter((el) => el.visible) // Only render visible elements
      .sort((a, b) => a.zIndex - b.zIndex) // Sort by z-index
      .map((element) => {
        // Sanitize numeric values to prevent injection
        const safeX = Number(element.x) || 0;
        const safeY = Number(element.y) || 0;
        const safeWidth = Number(element.width) || 0;
        const safeHeight = Number(element.height) || 0;
        const safeOpacity = Math.max(0, Math.min(1, Number(element.opacity) || 1));
        const safeRotation = Number(element.rotation) || 0;
        const safeZIndex = Number(element.zIndex) || 0;

        const style = `
          left: ${safeX}px;
          top: ${safeY}px;
          width: ${safeWidth}px;
          height: ${safeHeight}px;
          opacity: ${safeOpacity};
          transform: rotate(${safeRotation}deg);
          z-index: ${safeZIndex};
        `;
        let innerHtml = '';
        switch (element.type) {
          case 'text':
            const textEl = element as TextOverlayElement;
            // SECURITY: Escape all user-provided text content to prevent XSS
            const safeText = this.escapeHtml(textEl.text);
            const safeFontFamily = this.escapeHtml(textEl.fontFamily);
            const safeFontSize = Number(textEl.fontSize) || 16;
            const safeFill = this.escapeHtml(textEl.fill);
            const safeTextAlign = this.escapeHtml(textEl.textAlign);
            const safeFontWeight = this.escapeHtml(textEl.fontWeight);
            const safeFontStyle = this.escapeHtml(textEl.fontStyle);
            const safeTextDecoration = this.escapeHtml(textEl.textDecoration);
            innerHtml = `<span style="font-family: ${safeFontFamily}; font-size: ${safeFontSize}px; color: ${safeFill}; text-align: ${safeTextAlign}; font-weight: ${safeFontWeight}; font-style: ${safeFontStyle}; text-decoration: ${safeTextDecoration}; display: block; width: 100%; height: 100%; overflow: hidden;">${safeText}</span>`;
            break;
          case 'image':
            const imageEl = element as ImageOverlayElement;
            // SECURITY: Sanitize URL to prevent javascript: and data: URI attacks
            const safeImageSrc = this.sanitizeUrl(imageEl.src);
            innerHtml = `<img src="${safeImageSrc}" style="width: 100%; height: 100%; object-fit: contain;" alt="">`;
            break;
          case 'video':
            const videoEl = element as VideoOverlayElement;
            // SECURITY: Sanitize video source URL
            const safeVideoSrc = this.sanitizeUrl(videoEl.src);
            // For browser source, we can embed video directly. For webcam, it's more complex (media stream from client)
            // This assumes a URL to an actual video file.
            innerHtml = `<video src="${safeVideoSrc}" ${videoEl.loop ? 'loop' : ''} ${videoEl.autoplay ? 'autoplay' : ''} ${videoEl.muted ? 'muted' : ''} style="width: 100%; height: 100%;"></video>`;
            break;
          case 'web':
            const webEl = element as WebOverlayElement;
            // SECURITY: Sanitize iframe URL - extra caution required for iframes
            const safeWebUrl = this.sanitizeUrl(webEl.url);
            // iframe for web sources. Note: CORS issues can apply.
            // Added sandbox attribute for additional security
            innerHtml = `<iframe src="${safeWebUrl}" style="width: 100%; height: 100%; border: none;" sandbox="allow-scripts allow-same-origin"></iframe>`;
            break;
          case 'chat':
            const chatEl = element as ChatOverlayElement;
            // SECURITY: Escape color values to prevent CSS injection
            const safeBgColor = this.escapeHtml(chatEl.backgroundColor);
            const safeTextColor = this.escapeHtml(chatEl.textColor);
            const safeChatFontSize = Number(chatEl.fontSize) || 14;
            innerHtml = `<div class="chat-container" style="background-color: ${safeBgColor}; color: ${safeTextColor}; font-size: ${safeChatFontSize}px; height: 100%; overflow: hidden; display: flex; flex-direction: column-reverse;"><!-- Chat messages go here --></div>`;
            break;
          case 'alert':
            const alertEl = element as AlertOverlayElement;
            // SECURITY: Sanitize image URL and escape template text
            const safeAlertImage = this.sanitizeUrl(alertEl.defaultImage);
            // Escape the template and replace placeholder safely
            const safeTemplate = this.escapeHtml(alertEl.template.replace('{username}', 'New Viewer'));
            innerHtml = `<div class="alert-content" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;"><img src="${safeAlertImage}" style="max-width: 100px; max-height: 100px;" alt=""> <p>${safeTemplate}</p></div>`;
            break;
        }
        // SECURITY: Escape element ID and type to prevent attribute injection
        const safeId = this.escapeHtml(element.id);
        const safeType = this.escapeHtml(element.type);
        return `<div id="${safeId}" class="overlay-element ${safeType}" style="${style}">${innerHtml}</div>`;
      })
      .join('');
  }

  private generateCss(overlayConfig: OverlayElement[]): string {
    // This is for dynamic CSS for elements if needed, for now, mostly handled inline or by base styles
    return ``;
  }

  private generateJavascript(overlayConfig: OverlayElement[], internalUserId: string): string {
    // This script will run in the OBS browser source
    // SECURITY: Use DOM manipulation with textContent instead of innerHTML for user data
    return `
      <script>
          /**
           * Escapes HTML special characters to prevent XSS attacks.
           * This function is used for ANY user-provided content.
           */
          function escapeHtml(unsafe) {
              if (unsafe === undefined || unsafe === null) return '';
              const map = {
                  '&': '&amp;',
                  '<': '&lt;',
                  '>': '&gt;',
                  '"': '&quot;',
                  "'": '&#x27;',
                  '/': '&#x2F;',
                  '\`': '&#x60;',
                  '=': '&#x3D;'
              };
              return String(unsafe).replace(/[&<>"'\`=\\/]/g, function(char) {
                  return map[char] || char;
              });
          }

          /**
           * Validates and sanitizes a URL to prevent javascript: and data: URI attacks.
           */
          function sanitizeUrl(url) {
              if (!url) return '';
              const trimmedUrl = String(url).trim();
              const dangerousProtocols = /^(javascript|data|vbscript|file):/i;
              if (dangerousProtocols.test(trimmedUrl)) {
                  console.warn('Blocked potentially dangerous URL');
                  return '';
              }
              if (trimmedUrl.startsWith('http://') ||
                  trimmedUrl.startsWith('https://') ||
                  trimmedUrl.startsWith('/') ||
                  trimmedUrl.startsWith('./') ||
                  !trimmedUrl.includes(':')) {
                  return escapeHtml(trimmedUrl);
              }
              return '';
          }

          const socket = io(window.WEBSOCKET_URL);
          const overlayRoot = document.getElementById('overlay-root');
          const elements = window.overlayElements; // Access elements passed from backend

          // Map to store references to actual DOM elements
          const domElements = new Map();
          elements.forEach(el => {
              const domEl = document.getElementById(el.id);
              if (domEl) {
                  domElements.set(el.id, domEl);
              }
          });

          socket.on('connect', () => {
              console.log('Overlay connected to WebSocket server!');
              socket.emit('overlay-ready', { internalUserId: window.internalUserId });
          });

          socket.on('chat-message', (data) => {
              const chatElements = elements.filter(el => el.type === 'chat');
              chatElements.forEach(chatElConfig => {
                  const chatDomEl = domElements.get(chatElConfig.id);
                  if (chatDomEl) {
                      const chatContainer = chatDomEl.querySelector('.chat-container');
                      if (chatContainer) {
                          // SECURITY: Use DOM manipulation with textContent instead of innerHTML
                          const messageEl = document.createElement('div');
                          messageEl.classList.add('chat-message');

                          const userSpan = document.createElement('strong');
                          userSpan.textContent = (data.user || 'Anonymous') + ':';

                          const messageSpan = document.createElement('span');
                          messageSpan.textContent = ' ' + (data.message || '');

                          messageEl.appendChild(userSpan);
                          messageEl.appendChild(messageSpan);
                          chatContainer.prepend(messageEl); // Add new messages to top

                          // Trim messages if maxMessages is set
                          if (chatElConfig.maxMessages && chatContainer.children.length > chatElConfig.maxMessages) {
                              chatContainer.removeChild(chatContainer.lastChild);
                          }
                      }
                  }
              });
          });

          socket.on('new-follower-alert', (data) => {
              const alertElements = elements.filter(el => el.type === 'alert');
              alertElements.forEach(alertElConfig => {
                  const alertDomEl = domElements.get(alertElConfig.id);
                  if (alertDomEl) {
                      const alertContent = alertDomEl.querySelector('.alert-content');
                      if (alertContent) {
                          // SECURITY: Sanitize username before inserting into template
                          const safeUsername = escapeHtml(data.username || 'New Viewer');
                          const message = (alertElConfig.template || '{username} just followed!').replace('{username}', safeUsername);

                          // SECURITY: Use DOM manipulation instead of innerHTML
                          const alertDiv = document.createElement('div');
                          alertDiv.className = 'dynamic-alert';

                          const img = document.createElement('img');
                          const safeImageUrl = sanitizeUrl(alertElConfig.defaultImage);
                          if (safeImageUrl) {
                              img.src = safeImageUrl;
                          }
                          img.style.cssText = 'max-width: 100px; max-height: 100px;';
                          img.alt = '';

                          const p = document.createElement('p');
                          p.textContent = message;

                          alertDiv.appendChild(img);
                          alertDiv.appendChild(p);

                          // Basic animation (fade in/out)
                          alertDiv.style.opacity = 0;
                          alertDiv.style.transition = 'opacity 0.5s ease-in-out';
                          alertDomEl.appendChild(alertDiv);

                          setTimeout(() => {
                              alertDiv.style.opacity = 1; // Fade in
                          }, 10); // Small delay to ensure transition applies

                          setTimeout(() => {
                              alertDiv.style.opacity = 0; // Fade out
                              setTimeout(() => {
                                  alertDiv.remove();
                              }, 500); // Remove after fade out
                          }, alertElConfig.duration || 5000);
                      }
                  }
              });
          });

          // Other real-time event listeners would go here
      </script>
    `;
  }

  private getDefaultOverlayConfig(): OverlayElement[] {
    // A default minimal overlay if none is stored
    return [
      {
        id: 'default-text',
        type: 'text',
        x: 100,
        y: 100,
        width: 400,
        height: 50,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        locked: false,
        visible: true,
        name: 'Default Text',
        text: 'Welcome to Broadboi - Your Wingman for Epic Streams!',
        fontFamily: 'Arial',
        fontSize: 48,
        fill: '#FFFFFF',
        textAlign: 'center',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
      },
      {
        id: 'default-chat',
        type: 'chat',
        x: 10,
        y: 700,
        width: 350,
        height: 250,
        rotation: 0,
        opacity: 0.8,
        zIndex: 2,
        locked: false,
        visible: true,
        name: 'Default Chat',
        maxMessages: 7,
        fontSize: 18,
        textColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.6)',
      },
    ];
  }
}
