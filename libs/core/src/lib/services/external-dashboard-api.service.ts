import { Injectable, signal } from '@angular/core';

/**
 * External Dashboard API Service
 *
 * Exposes internal BroadBoi state via a mock local API or WebSocket for external
 * tools (e.g., a tablet dashboard or custom web overlay) to consume.
 *
 * Features:
 * - Data Exposure (Current Scene, Viewers, Chat)
 * - Remote Control (Switch Scene, Mute)
 * - Auth Token Management
 *
 * Issue: #301
 */

export interface ApiClient {
  id: string;
  name: string;
  token: string;
  permissions: string[];
  connectedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ExternalDashboardApiService {
  // State
  readonly connectedClients = signal<ApiClient[]>([]);
  readonly isApiEnabled = signal<boolean>(true);
  readonly port = signal<number>(3000);

  constructor() {}

  generateToken(name: string): string {
    const token = `bb_${crypto.randomUUID().replace(/-/g, '')}`;
    this.connectedClients.update(c => [...c, {
      id: crypto.randomUUID(),
      name,
      token,
      permissions: ['read', 'write'],
      connectedAt: new Date()
    }]);
    return token;
  }

  revokeToken(tokenId: string) {
    this.connectedClients.update(c => c.filter(client => client.token !== tokenId));
  }

  // In a real Electron app, this would start an Express/Fastify server
  startServer() {
    console.log(`External API Server started on port ${this.port()}`);
  }

  stopServer() {
    console.log('External API Server stopped');
  }
}
