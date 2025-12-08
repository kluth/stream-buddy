import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitchAuthService } from '../twitch-auth/twitch-auth.service';
import { YoutubeAuthService } from '../youtube-auth/youtube-auth.service';
import axios from 'axios';
import { StreamDestination, PlatformType } from './interfaces'; // Import interfaces
import { StreamMetadataDto } from './dto/stream-metadata.dto'; // Import StreamMetadataDto

@Injectable()
export class SimulcastService {
  private readonly logger = new Logger(SimulcastService.name);
  private readonly mediaMtxApiUrl: string;
  private readonly rtmpInputAddress: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly twitchAuthService: TwitchAuthService,
    private readonly youtubeAuthService: YoutubeAuthService,
  ) {
    const mediaMtxApiAddress = this.configService.get<string>('MEDIANTX_API_ADDRESS', 'http://localhost:9997');
    this.mediaMtxApiUrl = `${mediaMtxApiAddress}/v3/config/paths`;
    this.rtmpInputAddress = this.configService.get<string>('MEDIANTX_RTMP_ADDRESS', 'rtmp://localhost:1935'); // Default RTMP input
  }

  /**
   * Validates FFmpeg encoding parameters.
   * Throws an Error if any parameter is invalid.
   */
  private validateEncodingParameters(dest: StreamDestination): void {
    if (dest.videoBitrate !== undefined && (dest.videoBitrate <= 0 || !Number.isInteger(dest.videoBitrate))) {
      throw new Error(`Invalid video bitrate: ${dest.videoBitrate}. Must be a positive integer.`);
    }
    if (dest.audioBitrate !== undefined && (dest.audioBitrate <= 0 || !Number.isInteger(dest.audioBitrate))) {
      throw new Error(`Invalid audio bitrate: ${dest.audioBitrate}. Must be a positive integer.`);
    }
    if (dest.frameRate !== undefined && (dest.frameRate <= 0 || !Number.isInteger(dest.frameRate))) {
      throw new Error(`Invalid frame rate: ${dest.frameRate}. Must be a positive integer.`);
    }
    if (dest.keyframeInterval !== undefined && (dest.keyframeInterval <= 0 || !Number.isInteger(dest.keyframeInterval))) {
      throw new Error(`Invalid keyframe interval: ${dest.keyframeInterval}. Must be a positive integer.`);
    }
    if (dest.resolution !== undefined && !/^\d+x\d+$/.test(dest.resolution)) {
      throw new Error(`Invalid resolution format: ${dest.resolution}. Expected format "WxH".`);
    }

    // Add more validation for codecProfile and encodingPreset if specific valid values are known
    // For now, we'll allow any string, but in a real app, you might have a whitelist
  }

  /**
   * Builds the FFmpeg command string for simulcasting.
   * @param {StreamDestination[]} destinations - Array of stream destinations.
   * @param {string} streamPath - The path identifying the input stream in MediaMTX.
   * @returns {string} The FFmpeg command string.
   */
  public buildFfmpegCommand(destinations: StreamDestination[], streamPath: string): string {
    const inputUrl = `${this.rtmpInputAddress}/live/${streamPath}`; // Assuming client publishes via RTMP to this path
    let command = `ffmpeg -i ${inputUrl}`;

    // Default encoding parameters (H.264/AAC, CBR, common resolutions/bitrates)
    const DEFAULT_VIDEO_BITRATE = 2500; // kbps
    const DEFAULT_AUDIO_BITRATE = 128; // kbps
    const DEFAULT_RESOLUTION = '1280x720';
    const DEFAULT_FRAME_RATE = 30; // fps
    const DEFAULT_KEYFRAME_INTERVAL = 2; // seconds
    const DEFAULT_CODEC_PROFILE = 'main';
    const DEFAULT_ENCODING_PRESET = 'veryfast';

    destinations.forEach((dest) => {
      // Validate parameters before applying
      this.validateEncodingParameters(dest);

      const videoBitrate = dest.videoBitrate || DEFAULT_VIDEO_BITRATE;
      const audioBitrate = dest.audioBitrate || DEFAULT_AUDIO_BITRATE;
      const resolution = dest.resolution || DEFAULT_RESOLUTION;
      const frameRate = dest.frameRate || DEFAULT_FRAME_RATE;
      const keyframeInterval = dest.keyframeInterval || DEFAULT_KEYFRAME_INTERVAL;
      const codecProfile = dest.codecProfile || DEFAULT_CODEC_PROFILE;
      const encodingPreset = dest.encodingPreset || DEFAULT_ENCODING_PRESET;

      // Video encoding options
      command += ` -c:v libx264`;
      command += ` -b:v ${videoBitrate}k -maxrate ${videoBitrate}k -bufsize ${videoBitrate * 2}k`;
      command += ` -r ${frameRate} -g ${frameRate * keyframeInterval}`;
      
      // Scale filter for resolution: ensures aspect ratio is maintained. -2 means auto-calculate
      const [resWidth, resHeight] = resolution.split('x');
      command += ` -vf scale=${resWidth}:-2`;

      command += ` -profile:v ${codecProfile} -preset ${encodingPreset}`;

      // Audio encoding options
      command += ` -c:a aac`;
      command += ` -b:a ${audioBitrate}k -ar 44100 -ac 2`; // Standard audio settings

      let outputUrl: string;
      switch (dest.platformType) {
        case 'twitch':
          outputUrl = `rtmp://live.twitch.tv/app/${dest.streamKey}`;
          break;
        case 'youtube':
          outputUrl = `${dest.ingestionAddress}/${dest.streamName}`;
          break;
        case 'rtmp':
          outputUrl = dest.streamKey || '';
          break;
        default:
          this.logger.warn(`Unknown platform type: ${dest.platformType}`);
          return;
      }
      if (outputUrl) {
        command += ` -f flv "${outputUrl}"`; // Ensure quotes for complex URLs/keys
      }
    });

    return command;
  }

  /**
   * Starts a new simulcast session by configuring MediaMTX dynamically.
   * @param {string} internalUserId - Our internal user ID.
   * @param {StreamDestination[]} destinations - Array of platforms to stream to.
   * @returns {Promise<boolean>} True if simulcast started successfully, false otherwise.
   */
  async startSimulcast(internalUserId: string, destinations: StreamDestination[]): Promise<boolean> {
    const streamPath = `live/user_${internalUserId}`; // Unique path for this user's simulcast

    // Note: This currently assumes stream keys are provided in 'destinations'.
    // In a real scenario, you'd fetch them using twitchAuthService/youtubeAuthService if not provided.

    try {
      const ffmpegCommand = this.buildFfmpegCommand(destinations, streamPath);
      this.logger.debug(`FFmpeg command for simulcast: ${ffmpegCommand}`);

      const mediaMtxConfig = {
        source: `rtmp://${internalUserId}:password@localhost:1935/${streamPath}`, // Client publishes here
        runOnPublish: ffmpegCommand,
        runOnPublishRestart: true,
      };

      const addPathUrl = `${this.mediaMtxApiUrl}/add/${streamPath}`;
      await axios.post(addPathUrl, mediaMtxConfig);
      this.logger.log(`Simulcast path '${streamPath}' added to MediaMTX.`);
      return true;
    } catch (error) {
      this.logger.error(`Error starting simulcast for user ${internalUserId}: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`MediaMTX API Response: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  /**
   * Stops an active simulcast session by removing its configuration from MediaMTX.
   * @param {string} streamPath - The unique path of the simulcast stream in MediaMTX to stop.
   * @returns {Promise<boolean>} True if simulcast stopped successfully, false otherwise.
   */
  async stopSimulcast(streamPath: string): Promise<boolean> {
    try {
      const deletePathUrl = `${this.mediaMtxApiUrl}/${streamPath}`;
      await axios.delete(deletePathUrl);
      this.logger.log(`Simulcast path '${streamPath}' removed from MediaMTX.`);
      return true;
    } catch (error) {
      this.logger.error(`Error stopping simulcast for path ${streamPath}: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`MediaMTX API Response: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  /**
   * Updates stream metadata (title, game/category) for a specific platform.
   * @param {StreamMetadataDto} metadataDto - DTO containing platform, user ID, and metadata.
   * @returns {Promise<boolean>} True if metadata updated successfully, false otherwise.
   */
  async updateStreamMetadata(metadataDto: StreamMetadataDto): Promise<boolean> {
    const { internalUserId, platformType, title, gameId, youtubeCategoryId, description } = metadataDto;

    try {
      if (platformType === 'twitch') {
        const twitchUserId = await this.twitchAuthService.getTwitchUserId(internalUserId); // Needs implementation in TwitchAuthService
        if (!twitchUserId) {
          throw new Error('Could not get Twitch user ID.');
        }

        await this.twitchAuthService.updateChannelInfo(internalUserId, twitchUserId, { title, gameId }); // Needs implementation in TwitchAuthService
        this.logger.log(`Twitch metadata updated for user ${internalUserId}.`);
        return true;
      } else if (platformType === 'youtube') {
        const liveBroadcastId = await this.youtubeAuthService.getActiveLiveBroadcastId(internalUserId); // Needs implementation in YoutubeAuthService
        if (!liveBroadcastId) {
          throw new Error('No active YouTube live broadcast found.');
        }

        await this.youtubeAuthService.updateLiveBroadcast(internalUserId, liveBroadcastId, {
          title,
          description,
          categoryId: youtubeCategoryId,
        }); // Needs implementation in YoutubeAuthService
        this.logger.log(`YouTube metadata updated for user ${internalUserId}.`);
        return true;
      } else {
        this.logger.warn(`Metadata update not supported for platform type: ${platformType}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error updating stream metadata for user ${internalUserId} on ${platformType}: ${error.message}`);
      return false;
    }
  }
}
