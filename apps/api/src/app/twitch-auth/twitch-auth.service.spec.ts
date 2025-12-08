import { Test, TestingModule } from '@nestjs/testing';
import { TwitchAuthService } from './twitch-auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTokenEntity } from '../core/entities/user-token.entity';
import { encrypt, decrypt } from '../../shared/encryption.util'; // Import encryption utilities
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    if (key === 'TWITCH_CLIENT_ID') return 'mock-client-id';
    if (key === 'TWITCH_CLIENT_SECRET') return 'mock-client-secret';
    return null;
  }),
};

describe('TwitchAuthService', () => {
  let service: TwitchAuthService;
  let userTokenRepository: jest.Mocked<Repository<UserTokenEntity>>;

  beforeEach(async () => {
    // Clear all mocks before each test
    mockLogger.log.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear(); // Clear warn mock as well
    mockConfigService.get.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwitchAuthService,
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

    service = module.get<TwitchAuthService>(TwitchAuthService);
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

  it('should update channel info via Twitch API', async () => {
    const internalUserId = 'test-user-456';
    const twitchUserId = 'mockTwitchUserId';
    const updateData = { title: 'New Title', gameId: '12345' };
    const mockTokens = {
      accessToken: 'mockAccessToken',
      refreshToken: 'mockRefreshToken',
      expiresAt: new Date(),
      scopes: ['channel:manage:broadcast'],
    };

    jest.spyOn(service, 'getTokens').mockResolvedValue(mockTokens);
    
    const result = await service.updateChannelInfo(internalUserId, twitchUserId, updateData);

    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`Updating Twitch channel info for user ${internalUserId}`));
    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`Twitch channel info updated successfully`));
    expect(result).toBe(true);
  });

  it('should return false if no Twitch tokens are found when updating channel info', async () => {
    const internalUserId = 'no-tokens-user';
    const twitchUserId = 'mockTwitchUserId';
    const updateData = { title: 'New Title', gameId: '12345' };

    jest.spyOn(service, 'getTokens').mockResolvedValue(undefined);

    const result = await service.updateChannelInfo(internalUserId, twitchUserId, updateData);

    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`Updating Twitch channel info for user ${internalUserId}`));
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`No Twitch tokens found`));
    expect(result).toBe(false);
  });
});
