import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

// Updated StreamDestination interface to include FFmpeg encoding parameters
interface StreamDestination {
  id: string; // Unique ID for managing purposes in the UI
  platformType: 'twitch' | 'youtube' | 'rtmp';
  name: string; // Display name
  streamKey?: string;
  ingestionAddress?: string;
  streamName?: string;
  enabled: boolean;
  connected: boolean; // Indicates if the platform account is connected
  authUrl?: string; // For platforms requiring OAuth

  // New optional FFmpeg encoding parameters
  videoBitrate?: number; // in kbps
  audioBitrate?: number; // in kbps
  resolution?: string; // e.g., "1920x1080"
  frameRate?: number; // in fps
  keyframeInterval?: number; // in seconds
  codecProfile?: string; // e.g., "main", "high"
  encodingPreset?: string; // e.g., "ultrafast", "veryfast", "fast", "medium", "slow", "slower", "veryslow"
}

@Component({
  selector: 'app-simulcast-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulcast-setup.html',
  styleUrl: './simulcast-setup.scss',
})
export class SimulcastSetupComponent implements OnInit {
  private readonly API_BASE_URL = '/api'; // Adjust if your API is on a different base URL

  availableDestinations: StreamDestination[] = [
    { id: 'twitch', platformType: 'twitch', name: 'Twitch', enabled: false, connected: false },
    { id: 'youtube', platformType: 'youtube', name: 'YouTube', enabled: false, connected: false },
  ];

  customRtmpDestination: { url: string; streamKey: string; name: string } = { url: '', streamKey: '', name: '' };
  activeSimulcastStreamPath: string | null = null; // Stores the MediaMTX streamPath if simulcasting
  isSimulcasting = false;
  statusMessage: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    // In a real app, you'd load user's connected platforms and their status here
    // For now, we'll simulate.
  }

  // Placeholder for internal user ID. In a real app, this would come from an auth service.
  get internalUserId(): string {
    return 'user123'; // Hardcoded for now
  }

  async connectPlatform(destination: StreamDestination): Promise<void> {
    this.statusMessage = `Connecting to ${destination.name}...`;
    try {
      // Assuming backend provides auth URL for OAuth flow
      const response: any = await this.http.get(`${this.API_BASE_URL}/${destination.platformType}-auth/auth-url`).toPromise();
      if (response && response.authUrl) {
        // Store codeVerifier in session/local storage for PKCE callback
        localStorage.setItem(`${destination.platformType}CodeVerifier`, response.codeVerifier);
        window.location.href = response.authUrl; // Redirect to platform for auth
      } else {
        this.statusMessage = `Failed to get auth URL for ${destination.name}.`;
      }
    } catch (error: any) {
      this.statusMessage = `Error connecting to ${destination.name}: ${error.message}`;
      console.error(`Error connecting to ${destination.name}:`, error);
    }
  }

  addCustomRtmpDestination(): void {
    if (this.customRtmpDestination.url && this.customRtmpDestination.streamKey) {
      const newDest: StreamDestination = {
        id: `rtmp-${Date.now()}`,
        platformType: 'rtmp',
        name: this.customRtmpDestination.name || `Custom RTMP (${this.customRtmpDestination.url})`,
        streamKey: this.customRtmpDestination.streamKey,
        ingestionAddress: this.customRtmpDestination.url, // For RTMP, URL is the ingestion address
        enabled: true,
        connected: true,
        // Initialize new encoding parameters if desired
        videoBitrate: undefined,
        audioBitrate: undefined,
        resolution: undefined,
        frameRate: undefined,
        keyframeInterval: undefined,
        codecProfile: undefined,
        encodingPreset: undefined,
      };
      this.availableDestinations.push(newDest);
      this.customRtmpDestination = { url: '', streamKey: '', name: '' }; // Clear form
      this.statusMessage = 'Custom RTMP destination added.';
    } else {
      this.statusMessage = 'Please enter both URL and Stream Key for custom RTMP.';
    }
  }

  removeDestination(destinationId: string): void {
    this.availableDestinations = this.availableDestinations.filter(dest => dest.id !== destinationId);
    this.statusMessage = `Destination removed.`;
  }

  async startSimulcast(): Promise<void> {
    this.statusMessage = 'Starting simulcast...';
    this.isSimulcasting = true;

    const enabledDestinations = this.availableDestinations.filter(
      (dest) => dest.enabled && dest.connected
    ).map((dest) => {
      // Map to backend DTO format, handle YouTube's separate address/name
      // Include all encoding parameters
      return {
        platformType: dest.platformType,
        streamKey: dest.streamKey,
        ingestionAddress: dest.ingestionAddress,
        streamName: dest.streamName,
        internalUserId: this.internalUserId,
        videoBitrate: dest.videoBitrate,
        audioBitrate: dest.audioBitrate,
        resolution: dest.resolution,
        frameRate: dest.frameRate,
        keyframeInterval: dest.keyframeInterval,
        codecProfile: dest.codecProfile,
        encodingPreset: dest.encodingPreset,
      };
    });

    if (enabledDestinations.length === 0) {
      this.statusMessage = 'No destinations enabled for simulcast.';
      this.isSimulcasting = false;
      return;
    }

    try {
      const response: any = await this.http.post(`${this.API_BASE_URL}/simulcast/start`, {
        internalUserId: this.internalUserId,
        destinations: enabledDestinations,
      }).toPromise();
      this.activeSimulcastStreamPath = `live/user_${this.internalUserId}`; // Assuming this convention from backend
      this.statusMessage = response.message;
      this.isSimulcasting = true;
    } catch (error: any) {
      this.statusMessage = `Error starting simulcast: ${error.message}`;
      this.isSimulcasting = false;
      console.error('Error starting simulcast:', error);
    }
  }

  async stopSimulcast(): Promise<void> {
    this.statusMessage = 'Stopping simulcast...';
    try {
      if (!this.activeSimulcastStreamPath) {
        this.statusMessage = 'No active simulcast to stop.';
        return;
      }
      const response: any = await this.http.post(`${this.API_BASE_URL}/simulcast/stop`, {
        streamPath: this.activeSimulcastStreamPath,
      }).toPromise();
      this.statusMessage = response.message;
      this.isSimulcasting = false;
      this.activeSimulcastStreamPath = null;
    } catch (error: any) {
      this.statusMessage = `Error stopping simulcast: ${error.message}`;
      console.error('Error stopping simulcast:', error);
    }
  }
}
