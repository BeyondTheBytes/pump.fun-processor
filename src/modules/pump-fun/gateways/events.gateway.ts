import { Injectable, OnModuleInit } from "@nestjs/common";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import Redis from "ioredis";
import { Server, Socket } from "socket.io";

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }
})
export class PumpFunEventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server

  private redisSubs: Redis;

  constructor() {
    this.redisSubs = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    });
  }

  async onModuleInit() {
    await this.redisSubs.subscribe('token:created');
    await this.redisSubs.subscribe('trade:detected');
    await this.redisSubs.subscribe('stats:update');

    this.redisSubs.on('message', (channel, message) => {
      const payload = JSON.parse(message);

      switch (channel) {
        case 'token:created':
          this.server?.emit('token:created', payload);
          break;

        case 'trade:detected': ;
          this.server?.emit('trade:detected', payload);
          break;

        case 'stats:update':
          this.server?.emit('stats:update', payload);
          break;
      }
    })
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
}