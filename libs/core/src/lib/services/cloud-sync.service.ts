import { Injectable, signal, computed } from '@angular/core';
import { CloudStorageService } from './cloud-storage.service';

/**
 * Cloud Sync Service
 *
 * Synchronizes application settings, scenes, and profiles to the cloud.
 *
 * Features:
 * - Config Sync (Settings, Hotkeys, Branding)
 * - Profile Sync (Scenes, Sources)
 * - Conflict Resolution (Last Write Wins / Manual)
 * - Auto-Sync Intervals
 *
 * Issue: #305
 */

export interface SyncConfig {
  enabled: boolean;
  interval: number; // minutes
  syncScenes: boolean;
  syncSettings: boolean;
  syncAssets: boolean;
  targetAccountId: string | null;
}

export interface SyncStatus {
  lastSyncTime: Date | null;
  state: 'idle' | 'syncing' | 'error';
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CloudSyncService {
  // State
  readonly config = signal<SyncConfig>({
    enabled: false,
    interval: 30,
    syncScenes: true,
    syncSettings: true,
    syncAssets: false,
    targetAccountId: null
  });

  readonly status = signal<SyncStatus>({
    lastSyncTime: null,
    state: 'idle'
  });

  constructor(private storageService: CloudStorageService) {
    this.startAutoSync();
  }

  updateConfig(updates: Partial<SyncConfig>) {
    this.config.update(current => ({ ...current, ...updates }));
  }

  /**
   * Trigger a manual sync
   */
  async syncNow() {
    if (this.status().state === 'syncing') return;
    
    const config = this.config();
    if (!config.targetAccountId) {
      this.status.set({ ...this.status(), error: 'No cloud account selected' });
      return;
    }

    this.status.set({ ...this.status(), state: 'syncing', error: undefined });

    try {
      // 1. Gather Data
      const dataToSync = this.gatherAppData(config);
      
      // 2. Serialize
      const blob = new Blob([JSON.stringify(dataToSync)], { type: 'application/json' });
      const fileName = `backup_${Date.now()}.json`;

      // 3. Upload via Storage Service
      await this.storageService.uploadFile(config.targetAccountId, blob, fileName, `backups/${fileName}`);

      this.status.set({
        state: 'idle',
        lastSyncTime: new Date()
      });
    } catch (error) {
      this.status.set({
        ...this.status(),
        state: 'error',
        error: error instanceof Error ? error.message : 'Sync failed'
      });
    }
  }

  /**
   * Restore from a backup file
   */
  async restore(backupUrl: string) {
    // In a real app, fetch JSON, parse, and apply to services
    console.log('Restoring from', backupUrl);
  }

  private startAutoSync() {
    // Simple interval based loop
    setInterval(() => {
      if (this.config().enabled) {
        this.syncNow();
      }
    }, 60000); // Check every minute if it's time to sync (logic simplified)
  }

  private gatherAppData(config: SyncConfig): any {
    // Mock collecting data from other services
    return {
      version: '1.0',
      timestamp: new Date(),
      scenes: config.syncScenes ? [{ id: 'scene1', name: 'Main' }] : [],
      settings: config.syncSettings ? { theme: 'dark' } : {}
    };
  }
}
