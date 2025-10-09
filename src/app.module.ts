import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PumpFunConsumerService } from './modules/pump-fun/service/pump-fun-consumer.service';
import { PrismaService } from './modules/prisma/services/prisma.service';
import { TokenPrismaRepository } from './modules/pump-fun/db/repositories/prisma/token.prisma.repository';
import { PumpFunEventsGateway } from './modules/pump-fun/gateways/events.gateway';
import { StatisticsService } from './modules/statistics/services/statistics.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
      }
    }),
    BullModule.registerQueue({
      name: 'pump-fun-event'
    })
  ],
  controllers: [],
  providers: [
    PumpFunConsumerService,
    PrismaService,
    TokenPrismaRepository,
    PumpFunEventsGateway,
    StatisticsService
  ],
})
export class AppModule { }
