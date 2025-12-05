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

@Injectable()
export class OverlayRenderService {
  private readonly logger = new Logger(OverlayRenderService.name);
  private readonly WEBSOCKET_URL = 'http://localhost:3000'; // Frontend's WebSocket URL

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
        const style = `
          left: ${element.x}px;
          top: ${element.y}px;
          width: ${element.width}px;
          height: ${element.height}px;
          opacity: ${element.opacity};
          transform: rotate(${element.rotation}deg);
          z-index: ${element.zIndex};
        `;
        let innerHtml = '';
        switch (element.type) {
          case 'text':
            const textEl = element as TextOverlayElement;
            innerHtml = `<span style="font-family: ${textEl.fontFamily}; font-size: ${textEl.fontSize}px; color: ${textEl.fill}; text-align: ${textEl.textAlign}; font-weight: ${textEl.fontWeight}; font-style: ${textEl.fontStyle}; text-decoration: ${textEl.textDecoration}; display: block; width: 100%; height: 100%; overflow: hidden;">${textEl.text}</span>`;
            break;
          case 'image':
            const imageEl = element as ImageOverlayElement;
            innerHtml = `<img src="${imageEl.src}" style="width: 100%; height: 100%; object-fit: contain;">`;
            break;
          case 'video':
            const videoEl = element as VideoOverlayElement;
            // For browser source, we can embed video directly. For webcam, it's more complex (media stream from client)
            // This assumes a URL to an actual video file.
            innerHtml = `<video src="${videoEl.src}" ${videoEl.loop ? 'loop' : ''} ${videoEl.autoplay ? 'autoplay' : ''} ${videoEl.muted ? 'muted' : ''} style="width: 100%; height: 100%;"></video>`;
            break;
          case 'web':
            const webEl = element as WebOverlayElement;
            // iframe for web sources. Note: CORS issues can apply.
            innerHtml = `<iframe src="${webEl.url}" style="width: 100%; height: 100%; border: none;"></iframe>`;
            break;
          case 'chat':
            const chatEl = element as ChatOverlayElement;
            innerHtml = `<div class="chat-container" style="background-color: ${chatEl.backgroundColor}; color: ${chatEl.textColor}; font-size: ${chatEl.fontSize}px; height: 100%; overflow: hidden; display: flex; flex-direction: column-reverse;"><!-- Chat messages go here --></div>`;
            break;
          case 'alert':
            const alertEl = element as AlertOverlayElement;
            innerHtml = `<div class="alert-content" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;"><img src="${alertEl.defaultImage}" style="max-width: 100px; max-height: 100px;"> <p>${alertEl.template.replace('{username}', 'New Viewer')}</p></div>`;
            break;
        }
        return `<div id="${element.id}" class="overlay-element ${element.type}" style="${style}">${innerHtml}</div>`;
      })
      .join('');
  }

  private generateCss(overlayConfig: OverlayElement[]): string {
    // This is for dynamic CSS for elements if needed, for now, mostly handled inline or by base styles
    return ``;
  }

  private generateJavascript(overlayConfig: OverlayElement[], internalUserId: string): string {
    // This script will run in the OBS browser source
    return `
      <script>
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
                          const messageEl = document.createElement('div');
                          messageEl.classList.add('chat-message');
                          messageEl.innerHTML = '<strong>' + data.user + ':</strong> ' + data.message;
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
                          const message = alertElConfig.template.replace('{username}', data.username);
                          const alertDiv = document.createElement('div');
                          alertDiv.className = 'dynamic-alert';
                          alertDiv.innerHTML = '<img src="' + alertElConfig.defaultImage + '" style="max-width: 100px; max-height: 100px;"> <p>' + message + '</p>';
                          
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
