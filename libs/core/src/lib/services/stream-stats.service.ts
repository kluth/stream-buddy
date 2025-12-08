import { Injectable, signal } from '@angular/core';
import { StreamingStats } from '../models/streaming-session.types';

@Injectable({ providedIn: 'root' })
export class StreamStatsService {
  readonly stats = signal<StreamingStats | null>(null);
}
