import { Test, TestingModule } from '@nestjs/testing';
import { YoutubeAuthService } from './youtube-auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTokenEntity } from '../core/entities/user-token.entity';
import { encrypt, decrypt } from '../../shared/encryption.util'; // Import encryption utilities
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Mock googleapis
jest.mock('googleapis', () => {
  const mOAuth2Client = {
    setCredentials: jest.fn(),
  };
  const mYoutube = {
    liveBroadcasts: {
      list: jest.fn(),
      update: jest.fn(),
    },
    channels: {
      list: jest.fn(),
    },
  };
  return {
    google: {
      auth: {
        OAuth2: jest.fn(() => mOAuth2Client),
      },
      youtube: jest.fn(() => mYoutube),
    },
  };
});

import { google } from 'googleapis';

// Mock the entire TypeORM repository for UserTokenEntity
const mockUserTokenRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  clear: jest.fn(),
});

// Define a mock Logger
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// Define a mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'YOUTUBE_CLIENT_ID') return 'mock-client-id';
    if (key === 'YOUTUBE_CLIENT_SECRET') return 'mock-client-secret';
    return null;
  }),
};

describe('YoutubeAuthService', () => {
  let service: YoutubeAuthService;
  let userTokenRepository: jest.Mocked<Repository<UserTokenEntity>>;

  beforeEach(async () => {
    // Clear all mocks before each test
    mockLogger.log.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    mockConfigService.get.mockClear();
    (google.auth.OAuth2 as unknown as jest.Mock).mockClear();
    (google.youtube as unknown as jest.Mock).mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeAuthService,
        {
          provide: getRepositoryToken(UserTokenEntity),
          useFactory: mockUserTokenRepository,
        },
        {
          provide: Logger, // Provide the mock Logger
          useValue: mockLogger,
        },
        {
          provide: ConfigService, // Provide the mock ConfigService
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<YoutubeAuthService>(YoutubeAuthService);
    userTokenRepository = module.get(getRepositoryToken(UserTokenEntity));

    // Now clear the repository mocks on the actual instance AFTER it has been retrieved from the module
    userTokenRepository.create.mockClear();
    userTokenRepository.save.mockClear();
    userTokenRepository.findOne.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ... (skip encryption tests as they are fine) ...

  it('should retrieve active live broadcast ID', async () => {
    const internalUserId = 'test-user-youtube';
    const mockPlatformUserId = 'mockYoutubeUserId';
    const expectedLiveBroadcastId = 'dummyLiveBroadcastId';
    const mockTokens = {
      accessToken: 'mockAccessToken',
      refreshToken: 'mockRefreshToken',
      expiresAt: new Date(),
      scopes: [],
    };

    // Mock getTokens
    jest.spyOn(service, 'getTokens').mockResolvedValue(mockTokens);

    // Mock YouTube API response
    const mYoutube = (google.youtube as unknown as jest.Mock)();
    mYoutube.liveBroadcasts.list.mockResolvedValue({
      data: {
        items: [{ id: expectedLiveBroadcastId }],
      },
    });

    const result = await service.getActiveLiveBroadcastId(internalUserId);

    expect(service.getTokens).toHaveBeenCalledWith(internalUserId);
    expect(mYoutube.liveBroadcasts.list).toHaveBeenCalledWith(
      expect.objectContaining({ broadcastStatus: 'active' })
    );
    expect(result).toEqual(expectedLiveBroadcastId);
  });

  it('should return undefined for active live broadcast ID if no user token is found', async () => {
    const internalUserId = 'no-token-user-youtube';
    jest.spyOn(service, 'getTokens').mockResolvedValue(undefined);

    const result = await service.getActiveLiveBroadcastId(internalUserId);
    expect(result).toBeUndefined();
  });

  it('should update live broadcast info via YouTube API', async () => {
    const internalUserId = 'test-user-youtube';
    const liveBroadcastId = 'mockLiveBroadcastId';
    const updateData = { title: 'New YT Title', categoryId: '123' };
    const mockTokens = {
      accessToken: 'mockAccessToken',
      refreshToken: 'mockRefreshToken',
      expiresAt: new Date(),
      scopes: [],
    };

    jest.spyOn(service, 'getTokens').mockResolvedValue(mockTokens);
    const mYoutube = (google.youtube as unknown as jest.Mock)();
    mYoutube.liveBroadcasts.update.mockResolvedValue({});

    const result = await service.updateLiveBroadcast(internalUserId, liveBroadcastId, updateData);

    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`Updating YouTube live broadcast ${liveBroadcastId}`));
    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`YouTube live broadcast updated successfully`));
    expect(result).toBe(true);
  });

  it('should return false if no YouTube tokens are found when updating live broadcast info', async () => {
    const internalUserId = 'no-tokens-user-youtube';
    const liveBroadcastId = 'mockLiveBroadcastId';
    const updateData = { title: 'New YT Title' };

    jest.spyOn(service, 'getTokens').mockResolvedValue(undefined);

    const result = await service.updateLiveBroadcast(internalUserId, liveBroadcastId, updateData);

    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`Updating YouTube live broadcast ${liveBroadcastId}`));
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`No YouTube tokens found`));
    expect(result).toBe(false);
  });
});
