import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { Statistics } from '../types/stats';
import Redis from 'ioredis';
import { v4 as uuidV4 } from 'uuid';

@Injectable()
export class StatisticsService {
  redisPub: Redis

  private tokensCreatedSinceUp = 0;
  private totalTransactionsSinceUp = 0;
  private tradeTimestamps: number[] = [];

  constructor(private prisma: PrismaService) {
    setInterval(() => {
      const oneMinuteAgo = Date.now() - 60000;
      this.tradeTimestamps = this.tradeTimestamps.filter(t => t > oneMinuteAgo);
    }, 1000);

    this.redisPub = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    })

    setInterval(() => {
      this.cleanOldTimestamps();
    }, 5000);

    this.startPeriodicEmission();
  }

  async incrementTokensCreated() {
    await this.redisPub.incr('stats:tokensCreated');

  }

  async incrementTransaction() {
    await this.redisPub.incr('stats:totalTransactions');
    await this.redisPub.zadd('stats:tradeTimestamps', Date.now(), uuidV4());
  }

  async getStats(): Promise<Statistics> {
    // Tenta pegar eventsInDb do cache
    let eventsInDb = await this.redisPub.get('stats:dbCount');

    if (!eventsInDb) {
      const count = await this.prisma.token.count();
      await this.redisPub.set('stats:dbCount', count, 'EX', 10);
      eventsInDb = count.toString();
    }

    const tokensCreated = await this.redisPub.get('stats:tokensCreated');
    const totalTransactions = await this.redisPub.get('stats:totalTransactions');

    const oneSecondAgo = Date.now() - 1000;
    const tradesPerSecond = await this.redisPub.zcount(
      'stats:tradeTimestamps',
      oneSecondAgo,
      Date.now()
    );

    return {
      eventsInDb: parseInt(eventsInDb) || 0,
      tokensCreatedSinceUp: parseInt(tokensCreated || '0'),
      totalTransactions: parseInt(totalTransactions || '0'),
      tradesPerSecond,
    };
  }

  startPeriodicEmission() {
    setInterval(() => {
      this.publishStats();
    }, 1000);
  }

  async publishStats() {
    try {
      const stats = await this.getStats();
      await this.redisPub.publish('stats:update', JSON.stringify(stats));
    } catch (err) {
      console.error('Error fetching stats for publication:', err);
    }
  }

  private async cleanOldTimestamps() {
    const oneMinuteAgo = Date.now() - 60000;
    await this.redisPub.zremrangebyscore('stats:tradeTimestamps', 0, oneMinuteAgo);
  }

  async reset() {
    await this.redisPub.del('stats:tokensCreated');
    await this.redisPub.del('stats:totalTransactions');
    await this.redisPub.del('stats:tradeTimestamps');
    await this.redisPub.del('stats:dbCount');
  }
}