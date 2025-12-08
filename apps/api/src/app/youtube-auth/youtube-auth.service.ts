import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTokenEntity } from '../core/entities/user-token.entity';
import { encrypt, decrypt } from '../../shared/encryption.util';
import { google } from 'googleapis';

@Injectable()
export class YoutubeAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    @InjectRepository(UserTokenEntity)
    private userTokenRepository: Repository<UserTokenEntity>,
    private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('YOUTUBE_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('YOUTUBE_CLIENT_SECRET', '');
  }

  /**
   * Gets an authenticated OAuth2 client for the user.
   */
  async getOAuth2Client(internalUserId: string): Promise<any> {
    const tokens = await this.getTokens(internalUserId);
    if (!tokens) {
      throw new Error('No YouTube tokens found for user');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
    );
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    return oauth2Client;
  }

  /**
   * Retrieves the active YouTube live broadcast ID using REAL YouTube API.
   * @param {string} internalUserId - Our internal user ID.
   * @returns {Promise<string | undefined>} The active live broadcast ID, or undefined if not found.
   */
  async getActiveLiveBroadcastId(internalUserId: string): Promise<string | undefined> {
    this.logger.log(`Getting active YouTube live broadcast ID for internal user: ${internalUserId}`);
    try {
      const tokens = await this.getTokens(internalUserId);
      if (!tokens) {
        return undefined;
      }

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
      );
      oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const response = await youtube.liveBroadcasts.list({
        part: ['id', 'snippet', 'status'],
        broadcastStatus: 'active',
        mine: true,
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].id;
      }

      return undefined;
    } catch (error) {
      this.logger.error(`Failed to get active YouTube live broadcast ID for internal user ${internalUserId}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Updates YouTube live broadcast information using REAL YouTube API.
   * @param {string} internalUserId - Our internal user ID.
   * @param {string} liveBroadcastId - The ID of the live broadcast to update.
   * @param {object} data - Object containing optional `title`, `description`, `categoryId`.
   * @returns {Promise<boolean>} True if update succeeded, false otherwise.
   */
  async updateLiveBroadcast(
    internalUserId: string,
    liveBroadcastId: string,
    data: { title?: string; description?: string; categoryId?: string }
  ): Promise<boolean> {
    this.logger.log(
      `Updating YouTube live broadcast ${liveBroadcastId} for user ${internalUserId}: ${JSON.stringify(data)}`
    );
    try {
      const tokens = await this.getTokens(internalUserId);
      if (!tokens) {
        this.logger.warn(`No YouTube tokens found for user ${internalUserId}. Cannot update live broadcast.`);
        return false;
      }

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
      );
      oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      await youtube.liveBroadcasts.update({
        part: ['snippet', 'status'],
        requestBody: {
          id: liveBroadcastId,
          snippet: {
            title: data.title,
            description: data.description,
            categoryId: data.categoryId,
          } as any,
        },
      });

      this.logger.log(`YouTube live broadcast updated successfully for user ${internalUserId}.`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update YouTube live broadcast for user ${internalUserId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Gets YouTube channel statistics.
   */
  async getChannelStatistics(internalUserId: string): Promise<any> {
    try {
      const tokens = await this.getTokens(internalUserId);
      if (!tokens) {
        return null;
      }

      const oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
      );
      oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      const response = await youtube.channels.list({
        part: ['statistics', 'snippet'],
        mine: true,
      });

      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          subscriberCount: channel.statistics?.subscriberCount || 0,
          videoCount: channel.statistics?.videoCount || 0,
          viewCount: channel.statistics?.viewCount || 0,
          title: channel.snippet?.title || '',
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get channel statistics: ${error.message}`);
      return null;
    }
  }

  /**
   * Saves or updates YouTube user tokens in the database.
   * @param {string} internalUserId - The internal user ID.
   * @param {object} tokens - The tokens object containing accessToken, refreshToken, expiresAt, scopes.
   */
  async saveTokens(internalUserId: string, tokens: { accessToken: string; refreshToken: string; expiresAt: Date; scopes: string[] }): Promise<void> {
    this.logger.log(`Saving tokens for internal user: ${internalUserId}`);
    try {
      let userToken = await this.userTokenRepository.findOne({ where: { internalUserId, platform: 'youtube' } });

      const encryptedRefreshToken = encrypt(tokens.refreshToken);

      if (!userToken) {
        userToken = this.userTokenRepository.create({
          internalUserId,
          platform: 'youtube',
          platformUserId: 'placeholderYoutubeUserId', // This should be retrieved during OAuth flow
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
   * Retrieves YouTube user tokens from the database.
   * @param {string} internalUserId - The internal user ID.
   * @returns {object | undefined} The tokens object, or undefined if not found.
   */
  async getTokens(internalUserId: string): Promise<any | undefined> {
    this.logger.log(`Retrieving tokens for internal user: ${internalUserId}`);
    try {
      const userToken = await this.userTokenRepository.findOne({ where: { internalUserId, platform: 'youtube' } });

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
