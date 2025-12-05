import { Test, TestingModule } from '@nestjs/testing';
import { SimulcastService } from './simulcast.service';
import { TwitchAuthService } from '../twitch-auth/twitch-auth.service';
import { YoutubeAuthService } from '../youtube-auth/youtube-auth.service';
import { StreamDestination, PlatformType } from './interfaces';
import { ConfigService } from '@nestjs/config';

// Mock dependencies of SimulcastService
const mockTwitchAuthService = () => ({
  getTwitchUserId: jest.fn(),
  updateChannelInfo: jest.fn(),
});

const mockYoutubeAuthService = () => ({
  getActiveLiveBroadcastId: jest.fn(),
  updateLiveBroadcast: jest.fn(),
});

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string, defaultValue: any) => {
    if (key === 'MEDIANTX_API_ADDRESS') return 'http://localhost:9997';
    if (key === 'MEDIANTX_RTMP_ADDRESS') return 'rtmp://localhost:1935';
    return defaultValue;
  }),
};

describe('SimulcastService', () => {
  let service: SimulcastService;
  let twitchAuthService: jest.Mocked<TwitchAuthService>;
  let youtubeAuthService: jest.Mocked<YoutubeAuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulcastService,
        {
          provide: TwitchAuthService,
          useFactory: mockTwitchAuthService,
        },
        {
          provide: YoutubeAuthService,
          useFactory: mockYoutubeAuthService,
        },
        {
          provide: ConfigService, // Provide mock ConfigService
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SimulcastService>(SimulcastService);
    twitchAuthService = module.get(TwitchAuthService);
    youtubeAuthService = module.get(YoutubeAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should build FFmpeg command with specified encoding parameters', () => {
    const streamPath = 'live/test_stream';
    const destination: StreamDestination = {
      platformType: 'rtmp',
      ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: 'your_stream_key',
      internalUserId: 'user123',
      videoBitrate: 4000,
      audioBitrate: 128,
      resolution: '1280x720',
      frameRate: 30,
      keyframeInterval: 2,
      codecProfile: 'high',
      encodingPreset: 'veryfast',
    };

    const expectedCommandPart =
      ` -c:v libx264 -b:v 4000k -maxrate 4000k -bufsize 8000k -r 30 -g 60` +
      ` -vf scale=1280:-2 -profile:v high -preset veryfast` +
      ` -c:a aac -b:a 128k -ar 44100 -ac 2`;

    const ffmpegCommand = service.buildFfmpegCommand([destination], streamPath);
    expect(ffmpegCommand).toContain(expectedCommandPart);
  });

  // Failing test: should apply default encoding parameters if none are specified
  it('should apply default encoding parameters if none are specified (failing test)', () => {
    const streamPath = 'live/default_stream';
    const destination: StreamDestination = {
      platformType: 'rtmp',
      ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: 'your_stream_key',
      internalUserId: 'user123',
      // No encoding parameters specified
    };

    const expectedDefaultCommandPart =
      ` -c:v libx264 -b:v 2500k -maxrate 2500k -bufsize 5000k -r 30 -g 60` +
      ` -vf scale=1280:-2 -profile:v main -preset veryfast` +
      ` -c:a aac -b:a 128k -ar 44100 -ac 2`;
    
    const ffmpegCommand = service.buildFfmpegCommand([destination], streamPath);
    expect(ffmpegCommand).toContain(expectedDefaultCommandPart);
  });

  // Failing test: should throw an error for invalid encoding parameters
  it('should throw an error for invalid encoding parameters (failing test)', () => {
    const streamPath = 'live/invalid_stream';
    const destination: StreamDestination = {
      platformType: 'rtmp',
      ingestionAddress: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: 'your_stream_key',
      internalUserId: 'user123',
      videoBitrate: -100, // Invalid bitrate
    };

    expect(() => service.buildFfmpegCommand([destination], streamPath)).toThrow('Invalid video bitrate: -100');
  });
});
