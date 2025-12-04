import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTokenEntity } from '../core/entities/user-token.entity';
import { encrypt, decrypt } from '../../shared/encryption.util';
import { ApiClient } from '@twurple/api';
import { StaticAuthProvider } from '@twurple/auth';

@Injectable()
export class TwitchAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    @InjectRepository(UserTokenEntity)
    private userTokenRepository: Repository<UserTokenEntity>,
    private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('TWITCH_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('TWITCH_CLIENT_SECRET', '');
  }

  /**
   * Retrieves the Twitch user ID for a given internal user.
   * @param {string} internalUserId - Our internal user ID.
   * @returns {Promise<string | undefined>} The Twitch user ID, or undefined if not found.
   */
  async getTwitchUserId(internalUserId: string): Promise<string | undefined> {
    this.logger.log(`Getting Twitch user ID for internal user: ${internalUserId}`);
    try {
      const userToken = await this.userTokenRepository.findOne({ where: { internalUserId, platform: 'twitch' } });
      return userToken?.platformUserId;
    } catch (error) {
      this.logger.error(`Failed to get Twitch user ID for internal user ${internalUserId}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Updates Twitch channel information (title, game ID) using REAL Twitch API.
   * @param {string} internalUserId - Our internal user ID.
   * @param {string} twitchUserId - The Twitch user ID.
   * @param {object} data - Object containing optional `title` and `gameId`.
   * @returns {Promise<boolean>} True if update succeeded, false otherwise.
   */
  async updateChannelInfo(
    internalUserId: string,
    twitchUserId: string,
    data: { title?: string; gameId?: string }
  ): Promise<boolean> {
    this.logger.log(
      `Updating Twitch channel info for user ${internalUserId}, Twitch user ${twitchUserId}: ${JSON.stringify(data)}`
    );
    try {
      const tokens = await this.getTokens(internalUserId);
      if (!tokens) {
        this.logger.warn(`No Twitch tokens found for user ${internalUserId}. Cannot update channel info.`);
        return false;
      }

      // Create Twitch API client with user's access token
      const authProvider = new StaticAuthProvider(this.clientId, tokens.accessToken);
      const apiClient = new ApiClient({ authProvider });

      // Update channel information using real Twitch API
      if (data.gameId) {
        // Convert game name to game ID if needed
        const game = await apiClient.games.getGameByName(data.title || '');
        if (game) {
          data.gameId = game.id;
        }
      }

      await apiClient.channels.updateChannelInfo(twitchUserId, {
        title: data.title,
        gameId: data.gameId,
      });

      this.logger.log(`Twitch channel info updated successfully for user ${internalUserId}.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update Twitch channel info for user ${internalUserId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets Twitch stream information.
   */
  async getStreamInfo(internalUserId: string, twitchUserId: string): Promise<any> {
    try {
      const tokens = await this.getTokens(internalUserId);
      if (!tokens) {
        return null;
      }

      const authProvider = new StaticAuthProvider(this.clientId, tokens.accessToken);
      const apiClient = new ApiClient({ authProvider });

      const stream = await apiClient.streams.getStreamByUserId(twitchUserId);
      return stream ? {
        id: stream.id,
        title: stream.title,
        viewerCount: stream.viewers,
        startDate: stream.startDate,
        gameName: stream.gameName,
        thumbnailUrl: stream.thumbnailUrl,
      } : null;
    } catch (error) {
      this.logger.error(`Failed to get stream info: ${error.message}`);
      return null;
    }
  }

  /**
   * Gets follower count for a Twitch channel.
   */
  async getFollowerCount(internalUserId: string, twitchUserId: string): Promise<number> {
    try {
      const tokens = await this.getTokens(internalUserId);
      if (!tokens) {
        return 0;
      }

      const authProvider = new StaticAuthProvider(this.clientId, tokens.accessToken);
      const apiClient = new ApiClient({ authProvider });

      const followers = await apiClient.channels.getChannelFollowerCount(twitchUserId);
      return followers;
    } catch (error) {
      this.logger.error(`Failed to get follower count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Gets subscriber count for a Twitch channel.
   */
  async getSubscriberCount(internalUserId: string, twitchUserId: string): Promise<number> {
    try {
      const tokens = await this.getTokens(internalUserId);
      if (!tokens) {
        return 0;
      }

      const authProvider = new StaticAuthProvider(this.clientId, tokens.accessToken);
      const apiClient = new ApiClient({ authProvider });

      const subscriptions = await apiClient.subscriptions.getSubscriptions(twitchUserId);
      return subscriptions.total;
    } catch (error) {
      this.logger.error(`Failed to get subscriber count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Saves or updates Twitch user tokens in the database.
   * @param {string} internalUserId - The internal user ID.
   * @param {object} tokens - The tokens object containing accessToken, refreshToken, expiresAt, scopes.
   */
  async saveTokens(internalUserId: string, tokens: { accessToken: string; refreshToken: string; expiresAt: Date; scopes: string[] }): Promise<void> {
    this.logger.log(`Saving tokens for internal user: ${internalUserId}`);
    try {
      let userToken = await this.userTokenRepository.findOne({ where: { internalUserId, platform: 'twitch' } });

      const encryptedRefreshToken = encrypt(tokens.refreshToken);

      if (!userToken) {
        userToken = this.userTokenRepository.create({
          internalUserId,
          platform: 'twitch',
          platformUserId: 'placeholderTwitchUserId', // This should be retrieved during OAuth flow
          accessToken: tokens.accessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
        });
      } else {
        userToken.accessToken = tokens.accessToken;
        userToken.refreshToken = encryptedRefreshToken;
        userToken.expiresAt = tokens.expiresAt;
        userToken.scopes = tokens.scopes;
      }
      await this.userTokenRepository.save(userToken);
      this.logger.log(`Tokens saved/updated for internal user: ${internalUserId}`);
    } catch (error) {
      this.logger.error(`Failed to save tokens for user ${internalUserId}: ${error.message}`);
      throw error; // Re-throw the error after logging
    }
  }

  /**
   * Retrieves Twitch user tokens from the database.
   * @param {string} internalUserId - The internal user ID.
   * @returns {object | undefined} The tokens object, or undefined if not found.
   */
  async getTokens(internalUserId: string): Promise<any | undefined> {
    this.logger.log(`Retrieving tokens for internal user: ${internalUserId}`);
    try {
      const userToken = await this.userTokenRepository.findOne({ where: { internalUserId, platform: 'twitch' } });

      if (userToken) {
        return {
          accessToken: userToken.accessToken,
          refreshToken: decrypt(userToken.refreshToken),
          expiresAt: userToken.expiresAt,
          scopes: userToken.scopes,
        };
      }
      return undefined;
    } catch (error) {
      this.logger.error(`Failed to retrieve tokens for user ${internalUserId}: ${error.message}`);
      return undefined; // Return undefined on retrieval failure
    }
  }
}
