import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // seconds
  url: string;
  coverUrl?: string;
  provider: string; // 'local', 'epidemic', 'spotify', etc.
  copyrightStatus: 'safe' | 'unknown' | 'unsafe';
  tags: string[];
  addedAt: Date;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  songs: string[]; // Song IDs
  createdAt: Date;
}

export interface MusicPlayerState {
  currentSongId: string | null;
  isPlaying: boolean;
  volume: number; // 0-100
  muted: boolean;
  shuffle: boolean;
  repeat: 'none' | 'all' | 'one';
  currentTime: number; // seconds
  duration: number; // seconds
}

export interface MusicProvider {
  id: string;
  name: string;
  connected: boolean;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
}

const MOCK_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Stream Beats 1',
    artist: 'Harris Heller',
    album: 'LoFi',
    duration: 180,
    url: 'assets/music/song1.mp3',
    provider: 'local',
    copyrightStatus: 'safe',
    tags: ['lofi', 'chill'],
    addedAt: new Date(),
  },
  {
    id: 'song-2',
    title: 'Synthwave Mix',
    artist: 'Unknown',
    duration: 240,
    url: 'assets/music/song2.mp3',
    provider: 'local',
    copyrightStatus: 'safe',
    tags: ['synthwave', 'upbeat'],
    addedAt: new Date(),
  },
];

const MUSIC_PROVIDERS: Record<string, Omit<MusicProvider, 'id'>> = {
  epidemic: {
    name: 'Epidemic Sound',
    connected: false,
    icon: '🎵',
    status: 'disconnected',
  },
  artlist: {
    name: 'Artlist',
    connected: false,
    icon: '🎨',
    status: 'disconnected',
  },
  audiojungle: {
    name: 'AudioJungle',
    connected: false,
    icon: '🌿',
    status: 'disconnected',
  },
  soundstripe: {
    name: 'Soundstripe',
    connected: false,
    icon: '🦓',
    status: 'disconnected',
  },
  musicbed: {
    name: 'Musicbed',
    connected: false,
    icon: '🛏️',
    status: 'disconnected',
  },
  premiumbeat: {
    name: 'PremiumBeat',
    connected: false,
    icon: '💎',
    status: 'disconnected',
  },
  bensound: {
    name: 'Bensound',
    connected: false,
    icon: '🎸',
    status: 'disconnected',
  },
  incompetech: {
    name: 'Incompetech',
    connected: false,
    icon: '🎹',
    status: 'disconnected',
  },
  youtube: {
    name: 'YouTube Audio Library',
    connected: false,
    icon: '▶️',
    status: 'disconnected',
  },
  local: {
    name: 'Local Files',
    connected: true,
    icon: '📁',
    status: 'connected',
  },
};

@Injectable({
  providedIn: 'root',
})
export class MusicLibraryService {
  private readonly STORAGE_KEY = 'broadboi-music-library';

  // Reactive state
  readonly songs = signal<Song[]>(MOCK_SONGS);
  readonly playlists = signal<Playlist[]>([]);
  readonly playerState = signal<MusicPlayerState>({
    currentSongId: null,
    isPlaying: false,
    volume: 50,
    muted: false,
    shuffle: false,
    repeat: 'none',
    currentTime: 0,
    duration: 0,
  });
  readonly providers = signal<MusicProvider[]>([]);

  // Computed
  readonly currentSong = computed(() =>
    this.songs().find(s => s.id === this.playerState().currentSongId)
  );
  readonly safeSongs = computed(() =>
    this.songs().filter(s => s.copyrightStatus === 'safe')
  );

  // Events
  private readonly songEndedSubject = new Subject<Song>();
  public readonly songEnded$ = this.songEndedSubject.asObservable();

  // Audio element
  private audio: HTMLAudioElement | null = null;

  constructor() {
    this.loadLibrary();
    this.initializeProviders();
    this.initializeAudio();
  }

  private initializeAudio(): void {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.addEventListener('timeupdate', () => {
        this.playerState.update(state => ({
          ...state,
          currentTime: this.audio?.currentTime || 0,
          duration: this.audio?.duration || 0,
        }));
      });
      this.audio.addEventListener('ended', () => {
        const song = this.currentSong();
        if (song) {
          this.songEndedSubject.next(song);
          this.playNext();
        }
      });
    }
  }

  private initializeProviders(): void {
    const providerList = Object.entries(MUSIC_PROVIDERS).map(([id, data]) => ({
      id,
      ...data,
    })) as MusicProvider[];
    
    this.providers.set(providerList);
  }

  // ============ PLAYER CONTROLS ============

  play(songId?: string): void {
    if (songId) {
      const song = this.songs().find(s => s.id === songId);
      if (song && this.audio) {
        this.audio.src = song.url;
        this.playerState.update(state => ({ ...state, currentSongId: songId }));
      }
    }

    if (this.audio) {
      this.audio.play();
      this.playerState.update(state => ({ ...state, isPlaying: true }));
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
      this.playerState.update(state => ({ ...state, isPlaying: false }));
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.playerState.update(state => ({
        ...state,
        isPlaying: false,
        currentTime: 0,
      }));
    }
  }

  playNext(): void {
    // Simple next logic - in real app would handle shuffle/repeat/playlists
    const songs = this.songs();
    const currentIndex = songs.findIndex(s => s.id === this.playerState().currentSongId);
    const nextIndex = (currentIndex + 1) % songs.length;
    this.play(songs[nextIndex].id);
  }

  playPrevious(): void {
    const songs = this.songs();
    const currentIndex = songs.findIndex(s => s.id === this.playerState().currentSongId);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    this.play(songs[prevIndex].id);
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = volume / 100;
      this.playerState.update(state => ({ ...state, volume }));
    }
  }

  toggleMute(): void {
    if (this.audio) {
      this.audio.muted = !this.audio.muted;
      this.playerState.update(state => ({ ...state, muted: this.audio?.muted || false }));
    }
  }

  // ============ LIBRARY MANAGEMENT ============

  addSong(song: Omit<Song, 'id' | 'addedAt'>): void {
    const newSong: Song = {
      ...song,
      id: `song-${Date.now()}`,
      addedAt: new Date(),
    };
    this.songs.update(songs => [...songs, newSong]);
    this.saveLibrary();
  }

  removeSong(songId: string): void {
    this.songs.update(songs => songs.filter(s => s.id !== songId));
    this.saveLibrary();
  }

  createPlaylist(name: string, description?: string): string {
    const id = `playlist-${Date.now()}`;
    const playlist: Playlist = {
      id,
      name,
      description,
      songs: [],
      createdAt: new Date(),
    };
    this.playlists.update(playlists => [...playlists, playlist]);
    this.saveLibrary();
    return id;
  }

  addToPlaylist(playlistId: string, songId: string): void {
    this.playlists.update(playlists =>
      playlists.map(p =>
        p.id === playlistId && !p.songs.includes(songId)
          ? { ...p, songs: [...p.songs, songId] }
          : p
      )
    );
    this.saveLibrary();
  }

  // ============ PERSISTENCE ============

  private loadLibrary(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.songs) this.songs.set(data.songs);
        if (data.playlists) this.playlists.set(data.playlists);
      }
    } catch (error) {
      console.error('Failed to load music library:', error);
    }
  }

  private saveLibrary(): void {
    try {
      const data = {
        songs: this.songs(),
        playlists: this.playlists(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save music library:', error);
    }
  }
}