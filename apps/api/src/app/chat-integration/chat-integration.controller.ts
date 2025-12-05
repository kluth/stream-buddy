import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ChatIntegrationService, ChatCommand } from './chat-integration.service';

@Controller('chat')
export class ChatIntegrationController {
  private readonly logger = new Logger(ChatIntegrationController.name);

  constructor(private readonly chatService: ChatIntegrationService) {}

  /**
   * Connect to Twitch chat
   */
  @Post(':userId/twitch/connect')
  @HttpCode(HttpStatus.OK)
  async connectTwitchChat(
    @Param('userId') userId: string,
    @Body() body: { channels: string[] },
  ) {
    try {
      await this.chatService.connectTwitchChat(userId, body.channels);
      return {
        success: true,
        message: `Connected to Twitch chat in channels: ${body.channels.join(', ')}`,
      };
    } catch (error) {
      this.logger.error(`Failed to connect to Twitch chat: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disconnect from Twitch chat
   */
  @Delete(':userId/twitch/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectTwitchChat(@Param('userId') userId: string) {
    try {
      await this.chatService.disconnectTwitchChat(userId);
      return {
        success: true,
        message: 'Disconnected from Twitch chat',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Connect to YouTube chat
   */
  @Post(':userId/youtube/connect')
  @HttpCode(HttpStatus.OK)
  async connectYouTubeChat(
    @Param('userId') userId: string,
    @Body() body: { liveChatId?: string },
  ) {
    try {
      await this.chatService.connectYouTubeChat(userId, body.liveChatId);
      return {
        success: true,
        message: 'Connected to YouTube chat',
      };
    } catch (error) {
      this.logger.error(`Failed to connect to YouTube chat: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disconnect from YouTube chat
   */
  @Delete(':userId/youtube/disconnect')
  @HttpCode(HttpStatus.OK)
  disconnectYouTubeChat(@Param('userId') userId: string) {
    this.chatService.disconnectYouTubeChat(userId);
    return {
      success: true,
      message: 'Disconnected from YouTube chat',
    };
  }

  /**
   * Send a message to Twitch chat
   */
  @Post(':userId/twitch/send')
  @HttpCode(HttpStatus.OK)
  async sendTwitchMessage(
    @Param('userId') userId: string,
    @Body() body: { channel: string; message: string },
  ) {
    try {
      await this.chatService.sendTwitchMessage(userId, body.channel, body.message);
      return {
        success: true,
        message: 'Message sent to Twitch chat',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a message to YouTube chat
   */
  @Post(':userId/youtube/send')
  @HttpCode(HttpStatus.OK)
  async sendYouTubeMessage(
    @Param('userId') userId: string,
    @Body() body: { liveChatId: string; message: string },
  ) {
    try {
      await this.chatService.sendYouTubeMessage(userId, body.liveChatId, body.message);
      return {
        success: true,
        message: 'Message sent to YouTube chat',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get chat history
   */
  @Get(':userId/history')
  getChatHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.chatService.getChatHistory(userId, limitNum);
  }

  /**
   * Get chat statistics
   */
  @Get(':userId/statistics/:platform')
  getChatStatistics(
    @Param('userId') userId: string,
    @Param('platform') platform: 'twitch' | 'youtube',
  ) {
    return this.chatService.getChatStatistics(userId, platform);
  }

  /**
   * Get all registered commands
   */
  @Get(':userId/commands')
  getCommands() {
    return this.chatService.getCommands();
  }

  /**
   * Register a custom command
   */
  @Post(':userId/commands')
  @HttpCode(HttpStatus.CREATED)
  registerCommand(@Body() command: ChatCommand) {
    this.chatService.registerCommand(command);
    return {
      success: true,
      message: `Command !${command.name} registered`,
    };
  }

  /**
   * Unregister a command
   */
  @Delete(':userId/commands/:commandName')
  @HttpCode(HttpStatus.OK)
  unregisterCommand(@Param('commandName') commandName: string) {
    this.chatService.unregisterCommand(commandName);
    return {
      success: true,
      message: `Command !${commandName} unregistered`,
    };
  }

  /**
   * Add a banned word
   */
  @Post(':userId/moderation/banned-words')
  @HttpCode(HttpStatus.CREATED)
  addBannedWord(@Body() body: { word: string }) {
    this.chatService.addBannedWord(body.word);
    return {
      success: true,
      message: `Banned word added: ${body.word}`,
    };
  }

  /**
   * Remove a banned word
   */
  @Delete(':userId/moderation/banned-words/:word')
  @HttpCode(HttpStatus.OK)
  removeBannedWord(@Param('word') word: string) {
    this.chatService.removeBannedWord(word);
    return {
      success: true,
      message: `Banned word removed: ${word}`,
    };
  }

  /**
   * Add a spam filter
   */
  @Post(':userId/moderation/spam-filters')
  @HttpCode(HttpStatus.CREATED)
  addSpamFilter(
    @Body() body: { name: string; pattern: string; action: 'delete' | 'timeout' | 'ban' },
  ) {
    const regex = new RegExp(body.pattern, 'i');
    this.chatService.addSpamFilter(body.name, regex, body.action);
    return {
      success: true,
      message: `Spam filter added: ${body.name}`,
    };
  }

  /**
   * Remove a spam filter
   */
  @Delete(':userId/moderation/spam-filters/:name')
  @HttpCode(HttpStatus.OK)
  removeSpamFilter(@Param('name') name: string) {
    this.chatService.removeSpamFilter(name);
    return {
      success: true,
      message: `Spam filter removed: ${name}`,
    };
  }

  /**
   * Get moderation actions
   */
  @Get(':userId/moderation/actions')
  getModerationActions(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.chatService.getModerationActions(userId, limitNum);
  }

  /**
   * Timeout a user on Twitch
   */
  @Post(':userId/twitch/timeout')
  @HttpCode(HttpStatus.OK)
  async timeoutTwitchUser(
    @Param('userId') userId: string,
    @Body() body: { channel: string; username: string; duration: number; reason: string },
  ) {
    try {
      await this.chatService.timeoutTwitchUser(
        userId,
        body.channel,
        body.username,
        body.duration,
        body.reason,
      );
      return {
        success: true,
        message: `User ${body.username} timed out for ${body.duration} seconds`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Ban a user on Twitch
   */
  @Post(':userId/twitch/ban')
  @HttpCode(HttpStatus.OK)
  async banTwitchUser(
    @Param('userId') userId: string,
    @Body() body: { channel: string; username: string; reason: string },
  ) {
    try {
      await this.chatService.banTwitchUser(userId, body.channel, body.username, body.reason);
      return {
        success: true,
        message: `User ${body.username} banned`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete a message on Twitch
   */
  @Delete(':userId/twitch/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  async deleteTwitchMessage(
    @Param('userId') userId: string,
    @Param('messageId') messageId: string,
    @Query('channel') channel: string,
  ) {
    try {
      await this.chatService.deleteTwitchMessage(userId, channel, messageId);
      return {
        success: true,
        message: 'Message deleted',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
