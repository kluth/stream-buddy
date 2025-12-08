import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RemoteGuestService, RemoteGuest, GuestInvite } from '../../services/remote-guest.service';
import { I18nService, TranslatePipe } from '@broadboi/core';

@Component({
  selector: 'broadboi-remote-guest-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="guest-manager-container">
      <h3>{{ 'remoteGuest.title' | translate }}</h3>

      <div class="invite-section">
        <h4>{{ 'remoteGuest.inviteNewGuest' | translate }}</h4>
        <input type="text" [(ngModel)]="newGuestName" placeholder="{{ 'remoteGuest.guestNamePlaceholder' | translate }}">
        <button (click)="inviteGuest()">{{ 'remoteGuest.inviteButton' | translate }}</button>
      </div>

      <div class="invites-list-section">
        <h4>{{ 'remoteGuest.activeInvites' | translate }}</h4>
        @if (remoteGuestService.invites().length === 0) {
          <p>{{ 'remoteGuest.noActiveInvites' | translate }}</p>
        } @else {
          <div class="invite-card" *ngFor="let invite of remoteGuestService.invites()">
            <span>{{ invite.guestName || 'Guest' }} - {{ invite.code }}</span>
            <input type="text" [value]="invite.link" readonly>
            <button (click)="copyToClipboard(invite.link)">{{ 'remoteGuest.copyLink' | translate }}</button>
            <button (click)="removeInvite(invite.code)" class="danger">{{ 'common.delete' | translate }}</button>
          </div>
        }
      </div>

      <div class="connected-guests-section">
        <h4>{{ 'remoteGuest.connectedGuests' | translate }}</h4>
        @if (remoteGuestService.connectedGuests().length === 0) {
          <p>{{ 'remoteGuest.noConnectedGuests' | translate }}</p>
        } @else {
          <div class="guest-card" *ngFor="let guest of remoteGuestService.connectedGuests()">
            <span>{{ guest.name }} ({{ guest.status }})</span>
            <button (click)="toggleGuestVideo(guest.id)">{{ guest.config.videoEnabled ? ('remoteGuest.hideVideo' | translate) : ('remoteGuest.showVideo' | translate) }}</button>
            <button (click)="toggleGuestAudio(guest.id)">{{ guest.config.audioEnabled ? ('remoteGuest.muteAudio' | translate) : ('remoteGuest.unmuteAudio' | translate) }}</button>
            <button (click)="disconnectGuest(guest.id)" class="danger">{{ 'remoteGuest.disconnect' | translate }}</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .guest-manager-container {
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
      color: white;
      width: 500px;
      max-width: 90vw;
    }

    h3, h4 {
      color: #fff;
      margin-top: 0;
      margin-bottom: 15px;
    }

    .invite-section, .invites-list-section, .connected-guests-section {
      margin-bottom: 20px;
      padding: 15px;
      background: #1e1e1e;
      border-radius: 6px;
    }

    input[type="text"] {
      padding: 8px;
      margin-right: 10px;
      border-radius: 4px;
      border: 1px solid #555;
      background: #333;
      color: white;
      width: calc(100% - 100px);
    }

    button {
      padding: 8px 12px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      background: #4a4a4a;
      color: white;
      margin-left: 5px;
    }

    button.danger {
      background: #f44336;
    }

    .invite-card, .guest-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #333;
    }

    .invite-card:last-child, .guest-card:last-child {
      border-bottom: none;
    }
  `]
})
export class RemoteGuestManagerComponent {
  remoteGuestService = inject(RemoteGuestService);
  i18n = inject(I18nService); // For translations in component

  newGuestName = signal('');

  inviteGuest() {
    if (this.newGuestName().trim()) {
      this.remoteGuestService.inviteGuest(this.newGuestName());
      this.newGuestName.set('');
    }
  }

  removeInvite(code: string) {
    // This is a simplification; a real remove invite might be by guest ID or have specific logic
    const guest = this.remoteGuestService.guests().find(g => g.inviteCode === code);
    if (guest) {
        this.remoteGuestService.removeGuest(guest.id);
    }
    // Remove invite from invites signal directly
    this.remoteGuestService.invites.update(invites => invites.filter(i => i.code !== code));
  }

  toggleGuestVideo(guestId: string) {
    const guest = this.remoteGuestService.guests().find(g => g.id === guestId);
    if (guest) {
      if (guest.config.videoEnabled) {
        this.remoteGuestService.hideGuestVideo(guestId);
        this.remoteGuestService.updateGuestConfig(guestId, { videoEnabled: false });
      } else {
        this.remoteGuestService.showGuestVideo(guestId);
        this.remoteGuestService.updateGuestConfig(guestId, { videoEnabled: true });
      }
    }
  }

  toggleGuestAudio(guestId: string) {
    const guest = this.remoteGuestService.guests().find(g => g.id === guestId);
    if (guest) {
      if (guest.config.audioEnabled) {
        this.remoteGuestService.muteGuestAudio(guestId);
        this.remoteGuestService.updateGuestConfig(guestId, { audioEnabled: false });
      } else {
        this.remoteGuestService.unmuteGuestAudio(guestId);
        this.remoteGuestService.updateGuestConfig(guestId, { audioEnabled: true });
      }
    }
  }

  disconnectGuest(guestId: string) {
    this.remoteGuestService.disconnectGuest(guestId);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }
}
