// location.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class LocationGateway {
  @WebSocketServer()
  server: Server;

  sendLocationUpdate(data: any) {
    this.server.emit('locationUpdate', data);
  }

  @SubscribeMessage('joinVan')
  handleJoin(@MessageBody() vanId: string) {
    return { message: `Joined van ${vanId}` };
  }
}