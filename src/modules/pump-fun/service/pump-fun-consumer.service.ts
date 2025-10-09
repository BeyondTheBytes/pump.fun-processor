import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Connection, PublicKey } from "@solana/web3.js";
import { Job } from "bullmq";
import { CreateParser } from "src/modules/pump-fun/parsers/create-parser";
import { PumpFunEventType } from "src/modules/pump-fun/types/pump-fun-event.type";
import { EventClassifier } from "src/modules/pump-fun/utils/event-classifier";
import { TokenPrismaRepository } from "../db/repositories/prisma/token.prisma.repository";
import Redis from "ioredis";
import bs58 from 'bs58';
import { StatisticsService } from "src/modules/statistics/services/statistics.service";

@Processor('pump-fun-event', { concurrency: 10, limiter: { max: 10, duration: 1000 } })
export class PumpFunConsumerService extends WorkerHost {
  private redisPub: Redis;

  private connection: Connection
  private readonly PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

  constructor(
    private readonly tokenRepository: TokenPrismaRepository,
    private readonly statisticsService: StatisticsService,
  ) {
    super();
    this.redisPub = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    })

    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      { commitment: 'confirmed' }
    )
  }

  async process(job: Job): Promise<any> {
    const { signature, slot, logs, timestamp } = job.data;

    const eventType = EventClassifier.classify(logs);

    const baseData = {
      signature,
      slot,
      timestamp: new Date(timestamp),
    }

    try {
      let parsedEvent;

      switch (eventType) {
        case PumpFunEventType.CREATE: {
          parsedEvent = await this.parseCreateEvent(logs, signature, baseData)

          const savedToken = await this.tokenRepository.saveToken(parsedEvent)
          await this.redisPub.publish('token:created', JSON.stringify(savedToken, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));

          await this.statisticsService.incrementTokensCreated()
          await this.statisticsService.incrementTransaction()
          await this.statisticsService.publishStats()

          console.log(savedToken);
          break
        }

        case PumpFunEventType.TRADE: {
          parsedEvent = this.parseTradeEvent(logs, signature, baseData);
          const savedTrade = await this.tokenRepository.saveToken(parsedEvent);

          await this.statisticsService.incrementTransaction()
          await this.statisticsService.publishStats()

          console.log(savedTrade);

          await this.redisPub.publish('trade:detected', JSON.stringify(savedTrade, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));
          break;
        }
        default:
          return { status: 'skipped', reason: 'unhandled_event_type' };
      }

      if (!parsedEvent) {
        return { status: 'skipped', reason: 'parsing_failed' };
      }

      return { status: 'processed', signature };

    } catch (error) {
      console.error('Error processing job:', error);
      return { status: 'failed', reason: 'processing_error', error: error.message };
    }
  }

  private async parseCreateEvent(logs: string[], signature: string, baseData: any) {
    const tx = await this.safeGetTransaction(signature);
    if (!tx) return null;

    return CreateParser.parse(tx, this.PUMP_FUN_PROGRAM_ID, baseData);
  }

  private parseTradeEvent(logs: string[], signature: string, baseData: any) {
    const action: 'BUY' | 'SELL' = logs.includes('Buy') ? 'BUY' : 'SELL';
    const programDataLog = logs.find(log => log.startsWith('Program data: '));

    const result = {
      type: PumpFunEventType.TRADE,
      action,
      ...baseData
    };

    if (programDataLog) {
      const dataMatch = programDataLog.match(/Program data: (.+)/);
      if (dataMatch) {
        result.programData = dataMatch[1];
        try {
          const decoded = this.decodeProgramData(dataMatch[1]);

          if (!decoded) return result;

          return {
            ...result,
            mint: decoded.mint,
            solAmount: decoded.solAmount,
            tokenAmount: decoded.tokenAmount,
            isBuy: decoded.isBuy,
            virtualSolReserves: decoded.virtualSolReserves,
            virtualTokenReserves: decoded.virtualTokenReserves,
            realSolReserves: decoded.realSolReserves,
            realTokenReserves: decoded.realTokenReserves,
          }
        } catch (e) {
          console.error('Failed to decode program data:', e);
        }

      }
    }

    return result;
  }

  private decodeProgramData(base64Data: string) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length < 96) {
        console.warn('Program data too short:', buffer.length);
        return null;
      }

      let offset = 8;

      const mintBytes = buffer.subarray(offset, offset + 32);
      const mint = bs58.encode(mintBytes);
      offset += 32;

      const solAmountLamports = this.readU64LE(buffer, offset);
      const solAmount = solAmountLamports / 1e9;
      offset += 8;

      const tokenAmountRaw = this.readU64LE(buffer, offset);
      const tokenAmount = tokenAmountRaw / 1e9;
      offset += 8;

      const isBuy = buffer.readUInt8(offset) === 1;
      offset += 8;

      const virtualSolReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const virtualTokenReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const realSolReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const realTokenReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      return {
        mint,
        solAmount,
        tokenAmount,
        isBuy,
        virtualSolReserves,
        virtualTokenReserves,
        realSolReserves,
        realTokenReserves,
      };

    } catch (e) {
      console.error('Error decoding base64 program data:', e);
      return null;
    }
  }

  private readU64LE(buffer: Buffer, offset: number): number {
    // Lê 8 bytes como BigInt Little Endian
    const low = buffer.readUInt32LE(offset);
    const high = buffer.readUInt32LE(offset + 4);
    const value = BigInt(high) * BigInt(0x100000000) + BigInt(low);

    return Number(value);
  }

  private parseFromLogs(logs: string[]) {
    const nameLine = logs.find(l => l.includes('Token name:'));
    const mintLine = logs.find(l => l.includes('Mint:'));
    const symbolLine = logs.find(l => l.includes('Symbol:'));
    const uriLine = logs.find(l => l.includes('URI:'));
    const user = logs.find(l => l.includes('User:'));
    const bondingCurve = logs.find(l => l.includes('Bonding curve:'));

    console.log({
      nameLine,
      mintLine,
      symbolLine,
      uriLine,
      user,
      bondingCurve
    });


    if (!nameLine || !mintLine) return { complete: false };

    return {
      type: PumpFunEventType.CREATE,
      complete: true,
      name: nameLine.split(':')[1].trim(),
      mint: mintLine.split(':')[1].trim(),
      symbol: symbolLine ? symbolLine.split(':')[1].trim() : null,
      uri: uriLine ? uriLine.split(':')[1].trim() : null,
      user: user ? user.split(':')[1].trim() : null,
      bondingCurve: bondingCurve ? bondingCurve.split(':')[1].trim() : null,
    };
  }

  private async safeGetTransaction(signature: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const tx = await this.connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        if (tx) return tx;
      } catch (err: any) {
        if (err.message.includes('429')) {
          await new Promise(r => setTimeout(r, (i + 1) * 1500));
        } else throw err;
      }
    }
    return null;
  }


}