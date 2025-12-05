import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for development, refine in production
  },
})
export class StreamEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(StreamEventsGateway.name);

  handleConnection(client: Socket, ...args: any[]): any {
    this.logger.log(`Client connected: ${client.id}`);
    // Allow client to join a room based on their user ID (sent via query or auth token)
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(userId);
      this.logger.log(`Client ${client.id} joined room ${userId}`);
    }
  }

  handleDisconnect(client: Socket): any {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Placeholder for emitting events
  emitEvent(event: string, data: any): void {
    this.server.emit(event, data);
    this.logger.debug(`Emitted event "${event}" with data: ${JSON.stringify(data)}`);
  }

  emitToUser(userId: string, event: string, data: any): void {
    this.server.to(userId).emit(event, data);
    this.logger.debug(`Emitted event "${event}" to user ${userId} with data: ${JSON.stringify(data)}`);
  }
}
