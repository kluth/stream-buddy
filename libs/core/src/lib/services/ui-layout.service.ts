import { Injectable, signal, computed } from '@angular/core';

/**
 * UI Layout Service
 *
 * Manages customizable workspaces and panel layouts for the BroadBoi application.
 * Allows streamers to create "Editing", "Streaming", or "Just Chatting" dashboard layouts.
 *
 * Features:
 * - Drag-and-drop Panel Management
 * - Workspace Saving/Loading
 * - Panel State (Open/Closed, Size)
 *
 * Issue: #292
 */

export interface PanelConfig {
  id: string;
  type: string; // e.g., 'chat', 'preview', 'scenes', 'mixer'
  title: string;
  position: { x: number; y: number; w: number; h: number }; // Grid coordinates
  visible: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  panels: PanelConfig[];
  gridColumns: number;
  gridRows: number;
}

const DEFAULT_WORKSPACE: Workspace = {
  id: 'default-streaming',
  name: 'Streaming Default',
  gridColumns: 12,
  gridRows: 12,
  panels: [
    { id: 'p1', type: 'preview', title: 'Stream Preview', position: { x: 0, y: 0, w: 8, h: 6 }, visible: true },
    { id: 'p2', type: 'chat', title: 'Chat', position: { x: 8, y: 0, w: 4, h: 12 }, visible: true },
    { id: 'p3', type: 'scenes', title: 'Scenes', position: { x: 0, y: 6, w: 2, h: 6 }, visible: true },
    { id: 'p4', type: 'mixer', title: 'Audio Mixer', position: { x: 2, y: 6, w: 6, h: 6 }, visible: true }
  ]
};

@Injectable({
  providedIn: 'root'
})
export class UILayoutService {
  // State
  readonly activeWorkspace = signal<Workspace>(DEFAULT_WORKSPACE);
  readonly savedWorkspaces = signal<Workspace[]>([DEFAULT_WORKSPACE]);

  constructor() {
    this.loadWorkspaces();
  }

  /**
   * Activate a specific workspace
   */
  loadWorkspace(id: string) {
    const workspace = this.savedWorkspaces().find(w => w.id === id);
    if (workspace) {
      this.activeWorkspace.set(JSON.parse(JSON.stringify(workspace))); // Deep copy
    }
  }

  /**
   * Save current state as a new workspace
   */
  saveWorkspaceAs(name: string) {
    const newWorkspace: Workspace = {
      ...this.activeWorkspace(),
      id: crypto.randomUUID(),
      name
    };
    this.savedWorkspaces.update(w => [...w, newWorkspace]);
    this.saveToStorage();
  }

  /**
   * Update panel configuration in active workspace
   */
  updatePanel(panelId: string, updates: Partial<PanelConfig>) {
    const current = this.activeWorkspace();
    const updatedPanels = current.panels.map(p => p.id === panelId ? { ...p, ...updates } : p);
    
    this.activeWorkspace.set({ ...current, panels: updatedPanels });
    
    // Auto-save current workspace state if it matches a saved ID?
    // For now, explicitly save is safer.
  }

  /**
   * Delete workspace
   */
  deleteWorkspace(id: string) {
    if (id === 'default-streaming') return; // Protect default
    this.savedWorkspaces.update(w => w.filter(ws => ws.id !== id));
    this.saveToStorage();
  }

  private saveToStorage() {
    localStorage.setItem('broadboi-workspaces', JSON.stringify(this.savedWorkspaces()));
  }

  private loadWorkspaces() {
    const stored = localStorage.getItem('broadboi-workspaces');
    if (stored) {
      this.savedWorkspaces.set(JSON.parse(stored));
    }
  }
}
