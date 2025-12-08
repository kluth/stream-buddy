import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

// ... (Types)

export interface RepurposedContent {
  id: string;
  sourceRecordingId: string;
  platform: string;
  createdAt: Date;
  videoBlob: Blob;
  thumbnailBlob?: Blob;
  duration: number;
  fileSize: number;
  title: string;
  description: string;
  hashtags: string[];
  captions?: string;
  viralityScore?: number;
  engagementPrediction?: number;
  qualityScore?: number;
  sourceTimestamp: number;
  processingTime: number;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface ViralMoment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  score: number;
  reason: string;
  tags: string[];
  thumbnail?: string;
  suggestedPlatforms: string[];
}

export type ContentAspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

@Injectable({ providedIn: 'root' })
export class AIContentRepurposingService {
  readonly repurposedContent = signal<RepurposedContent[]>([]);
  
  // ...

  private async createPlatformContent(
    config: any,
    platform: string,
    startTime: number,
    duration: number
  ): Promise<RepurposedContent> {
    // ...
    const content: RepurposedContent = {
      id: `content-${Date.now()}`,
      sourceRecordingId: config.sourceRecordingId,
      platform,
      createdAt: new Date(),
      videoBlob: new Blob(),
      duration,
      fileSize: 0,
      title: '',
      description: '',
      hashtags: [],
      sourceTimestamp: startTime,
      processingTime: 0,
      status: 'processing',
    };

    // Fix: Ensure array type match
    this.repurposedContent.update(contents => [...contents, content]);

    // ... (rest of logic)
    return content;
  }

  async detectViralMoments(
    recordingId: string,
    videoBlob: Blob,
    contentType: string
  ): Promise<ViralMoment[]> {
    // ...
    const analysis = await this.analyzeVideoForVirality(videoBlob, contentType);
    
    const moments: ViralMoment[] = [];
    analysis.forEach((segment, index) => {
      if (segment.score >= 70) {
        // Fix: Ensure duration property exists
        const duration = segment.endTime - segment.startTime;
        const moment: ViralMoment = {
          id: `moment-${index}`,
          startTime: segment.startTime,
          endTime: segment.endTime,
          duration,
          score: segment.score,
          reason: segment.reason,
          tags: segment.tags,
          suggestedPlatforms: []
        };
        moments.push(moment);
      }
    });
    
    return moments;
  }

  private async analyzeVideoForVirality(blob: Blob, type: string): Promise<any[]> {
    return [{ startTime: 0, endTime: 10, score: 80, reason: 'Test', tags: [] }];
  }
}