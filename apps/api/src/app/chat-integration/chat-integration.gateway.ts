import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatMessage, ChatModerationAction, ChatStatistics } from './chat-integration.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatIntegrationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatIntegrationGateway.name);

  afterInit(server: Server) {
    this.logger.log('Chat WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected to chat gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from chat gateway: ${client.id}`);
  }

  /**
   * Subscribe to chat events for a specific user
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `user:${data.userId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to chat for user ${data.userId}`);
    return { success: true, message: `Subscribed to chat for user ${data.userId}` };
  }

  /**
   * Unsubscribe from chat events
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `user:${data.userId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} unsubscribed from chat for user ${data.userId}`);
    return { success: true, message: `Unsubscribed from chat for user ${data.userId}` };
  }

  /**
   * Listen for chat.message events and broadcast to subscribed clients
   */
  @OnEvent('chat.message')
  handleChatMessage(message: ChatMessage) {
    // Broadcast to all clients subscribed to this user's chat
    // For now, we'll broadcast to all clients
    this.server.emit('message', message);
  }

  /**
   * Listen for chat.subscription events
   */
  @OnEvent('chat.subscription')
  handleSubscription(data: any) {
    this.server.emit('subscription', data);
  }

  /**
   * Listen for chat.resubscription events
   */
  @OnEvent('chat.resubscription')
  handleResubscription(data: any) {
    this.server.emit('resubscription', data);
  }

  /**
   * Listen for chat.gift_upgrade events
   */
  @OnEvent('chat.gift_upgrade')
  handleGiftUpgrade(data: any) {
    this.server.emit('gift_upgrade', data);
  }

  /**
   * Listen for chat.community_gift events
   */
  @OnEvent('chat.community_gift')
  handleCommunityGift(data: any) {
    this.server.emit('community_gift', data);
  }

  /**
   * Listen for chat.raid events
   */
  @OnEvent('chat.raid')
  handleRaid(data: any) {
    this.server.emit('raid', data);
  }

  /**
   * Listen for chat.moderation events
   */
  @OnEvent('chat.moderation')
  handleModeration(action: ChatModerationAction) {
    this.server.emit('moderation', action);
  }

  /**
   * Listen for chat.statistics events
   */
  @OnEvent('chat.statistics')
  handleStatistics(stats: ChatStatistics) {
    this.server.emit('statistics', stats);
  }
}
