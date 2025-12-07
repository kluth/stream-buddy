import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StreamDeckService, StreamDeckButton } from '../../services/stream-deck.service';

@Component({
  selector: 'broadboi-virtual-stream-deck',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="virtual-deck">
      <div class="deck-header">
        <h3>📱 Virtual Stream Deck</h3>
        <div class="profile-selector">
          <select [value]="streamDeckService.currentProfile()?.id" (change)="switchProfile($event)">
            <option *ngFor="let profile of streamDeckService.profiles()" [value]="profile.id">
              {{ profile.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="deck-grid" [style.grid-template-columns]="'repeat(' + (currentDevice()?.columns || 5) + ', 1fr)'">
        @for (btn of gridButtons(); track $index) {
          <div class="deck-button-slot">
            @if (btn) {
              <button class="deck-button"
                      [style.background-color]="btn.config.backgroundColor"
                      [style.color]="btn.config.textColor"
                      [style.font-size.px]="btn.config.fontSize"
                      [class.pressed]="btn.pressed"
                      (mousedown)="onPress(btn)"
                      (mouseup)="onRelease(btn)"
                      (touchstart)="onPress(btn)"
                      (touchend)="onRelease(btn)">
                <div class="button-content">
                  <i *ngIf="btn.config.icon" class="button-icon">{{ btn.config.icon }}</i> <!-- Placeholder for icon -->
                  <span class="button-label">{{ btn.config.label }}</span>
                </div>
              </button>
            } @else {
              <div class="empty-slot"></div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .virtual-deck {
      background: #111;
      padding: 20px;
      border-radius: 15px;
      border: 2px solid #333;
      width: fit-content;
      margin: 0 auto;
      user-select: none;
    }

    .deck-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      color: #fff;
    }

    .deck-grid {
      display: grid;
      gap: 10px;
      background: #000;
      padding: 15px;
      border-radius: 10px;
    }

    .deck-button-slot {
      width: 80px;
      height: 80px;
      background: #222;
      border-radius: 8px;
    }

    .deck-button {
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s, filter 0.1s;
      box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
      padding: 5px;
      overflow: hidden;
    }

    .deck-button:active, .deck-button.pressed {
      transform: scale(0.95);
      filter: brightness(1.2);
    }

    .button-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      text-align: center;
      line-height: 1.2;
    }

    .empty-slot {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      background: #1a1a1a;
      box-shadow: inset 0 0 5px rgba(0,0,0,0.5);
    }
  `]
})
export class VirtualStreamDeckComponent {
  streamDeckService = inject(StreamDeckService);

  currentDevice = computed(() => {
    const devices = this.streamDeckService.devices();
    return devices.length > 0 ? devices[0] : null;
  });

  gridButtons = computed(() => {
    const device = this.currentDevice();
    if (!device) return [];

    const buttons: (StreamDeckButton | null)[] = new Array(device.keyCount).fill(null);
    const activeButtons = this.streamDeckService.buttons().filter(b => b.deviceId === device.id);

    activeButtons.forEach(btn => {
      if (btn.keyIndex < buttons.length) {
        buttons[btn.keyIndex] = btn;
      }
    });

    return buttons;
  });

  constructor() {
    // Initialize a virtual device if none exists
    if (!this.streamDeckService.devices().length) {
      this.streamDeckService.registerDevice('xl', 'VIRTUAL-DECK-001');
      this.setupDefaultProfile();
    }
  }

  setupDefaultProfile() {
    const device = this.streamDeckService.devices()[0];
    if (!device) return;

    // Row 1: Scene Switching
    this.streamDeckService.configureButton(device.id, 0, {
      label: 'Scene 1',
      action: 'switch-scene',
      actionParams: { sceneId: 'scene-1' },
      backgroundColor: '#2196F3'
    });
    this.streamDeckService.configureButton(device.id, 1, {
      label: 'Scene 2',
      action: 'switch-scene',
      actionParams: { sceneId: 'scene-2' },
      backgroundColor: '#2196F3'
    });

    // Row 2: Media Control
    this.streamDeckService.configureButton(device.id, 8, {
      label: 'Mute Mic',
      action: 'mute-audio',
      toggleMode: true,
      backgroundColor: '#F44336'
    });
    
    // Row 3: Streaming
    this.streamDeckService.configureButton(device.id, 24, {
      label: 'START STREAM',
      action: 'start-stream',
      backgroundColor: '#4CAF50',
      fontSize: 14
    });
    this.streamDeckService.configureButton(device.id, 25, {
      label: 'REC',
      action: 'start-recording',
      toggleMode: true,
      backgroundColor: '#FF9800'
    });
  }

  onPress(btn: StreamDeckButton) {
    this.streamDeckService.handleButtonPress(btn.deviceId, btn.keyIndex);
  }

  onRelease(btn: StreamDeckButton) {
    this.streamDeckService.handleButtonRelease(btn.deviceId, btn.keyIndex);
  }

  switchProfile(event: any) {
    this.streamDeckService.loadProfile(event.target.value);
  }
}
