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
import { GraduationParser } from "../parsers/graduate-parser";

@Processor('pump-fun-event',)
export class PumpFunConsumerService extends WorkerHost {
  private redisPub: Redis;

  private connection: Connection
  private readonly PUMP_FUN_PROGRAM_ID: PublicKey

  private cachedSolUsdRate: number = 0;
  private rateLastFetched: number = 0;

  constructor(
    private readonly tokenRepository: TokenPrismaRepository,
    private readonly statisticsService: StatisticsService,

  ) {
    super();
    if (!process.env.PROGRAM_ID) throw new Error('PROGRAM_ID env variable is not set');
    this.PUMP_FUN_PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID);

    this.redisPub = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    })

    this.connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      { commitment: 'confirmed' }
    )

    this.startSolUsdRateUpdater();
  }

  private async startSolUsdRateUpdater() {
    const fetchRate = async () => {
      try {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const json = await resp.json();
        const rate = json.solana?.usd;
        if (typeof rate === 'number') {
          this.cachedSolUsdRate = rate;
          this.rateLastFetched = Date.now();
        }
      } catch (e) {
        console.warn('Failed to update SOL→USD rate:', e);
      }
    };

    await fetchRate();

    setInterval(fetchRate, 60 * 1000);
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
          parsedEvent = CreateParser.parseFromLogs(logs, this.PUMP_FUN_PROGRAM_ID, baseData);

          console.log(parsedEvent);


          if (!parsedEvent || !parsedEvent.mint) {
            return { status: 'skipped', reason: 'parsing_failed' };
          }

          const savedToken = await this.tokenRepository.saveCreateTokenEvent(parsedEvent)

          const currentAth = await this.tokenRepository.getCurrentAth(parsedEvent.mint);
          const tokenWithAth = {
            ...savedToken,
            currentAth: currentAth ? { priceSol: currentAth.priceSol, priceUsd: currentAth.priceUsd } : null
          };

          await this.redisPub.publish('token:created', JSON.stringify(tokenWithAth, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));

          await this.statisticsService.incrementTokensCreated()
          await this.statisticsService.incrementDbCount()
          await this.statisticsService.incrementTransaction()
          await this.statisticsService.publishStats()
          break
        }

        case PumpFunEventType.TRADE: {
          parsedEvent = this.parseTradeEvent(logs, signature, baseData);

          if (!parsedEvent || !parsedEvent.mint) {
            return { status: 'skipped', reason: 'parsing_failed' };
          }

          const isCreatedToken = await this.tokenRepository.existsCreatedToken(parsedEvent.mint);

          if (!isCreatedToken) {
            return { status: 'skipped', reason: 'token_not_observed_by_us' };
          }

          const savedTrade = await this.tokenRepository.saveTradeEvent(parsedEvent);

          const priceSol = this.computePriceSol(parsedEvent.virtualSolReserves, parsedEvent.virtualTokenReserves);
          const priceUsd = priceSol * this.cachedSolUsdRate;
          const formattedUsd = this.formatUsd(priceUsd);

          const currentAth = await this.tokenRepository.getCurrentAth(parsedEvent.mint);

          if (!currentAth || priceUsd > Number(currentAth.priceUsd)) {
            await this.tokenRepository.insertAthHistory({
              mint: parsedEvent.mint,
              priceSol,
              signature,
              slot: BigInt(slot),
              timestamp: parsedEvent.timestamp,
            })
            await this.tokenRepository.upsertCurrentAth({
              mint: parsedEvent.mint,
              priceSol,
            })

            await this.statisticsService.incrementDbCount()

            await this.redisPub.publish('token:athUpdated', JSON.stringify({
              mint: parsedEvent.mint,
              priceSol,
              priceUsd,
              formattedUsd,
              timestamp: parsedEvent.timestamp,
            }))
          }


          await this.statisticsService.incrementTransaction()
          await this.statisticsService.incrementDbCount()
          await this.statisticsService.publishStats()

          await this.redisPub.publish('trade:detected', JSON.stringify(savedTrade, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));
          break;
        }
        case PumpFunEventType.GRADUATION: {
          const parsedEvent = GraduationParser.parse(logs, this.PUMP_FUN_PROGRAM_ID, signature, slot, timestamp);
          if (!parsedEvent) {
            return { status: 'skipped', reason: 'parsing_failed' };
          }

          const isCreatedToken = await this.tokenRepository.existsCreatedToken(parsedEvent.tokenMint);

          if (!isCreatedToken) {
            return { status: 'skipped', reason: 'token_not_observed_by_us' };
          }

          const savedGraduation = await this.tokenRepository.saveGraduationEvent({ ...parsedEvent, signature, slot, timestamp });

          const tokenData = await this.tokenRepository.getTokenByMint(parsedEvent.tokenMint);

          await this.redisPub.publish('token:graduated', JSON.stringify({
            graduationEvent: savedGraduation,
            tokenData
          }, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));

          await this.statisticsService.incrementTokenGraduated()
          await this.statisticsService.incrementTransaction()
          await this.statisticsService.incrementDbCount()
          await this.statisticsService.publishStats()

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

  private parseTradeEvent(logs: string[], signature: string, baseData: any) {
    const programDataLog = logs.find(log => log.startsWith('Program data: '));

    const result = {
      type: PumpFunEventType.TRADE,
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
            action: decoded.isBuy ? 'BUY' : 'SELL',
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

      const solAmountRaw = this.readU64LE(buffer, offset);
      const solAmount = solAmountRaw / 1e9;
      offset += 8;

      const tokenAmountRaw = this.readU64LE(buffer, offset);
      const tokenAmount = tokenAmountRaw / 1e9;
      offset += 8;

      const isBuy = buffer.readUInt8(offset) === 1;
      offset += 1;

      const user = bs58.encode(buffer.subarray(offset, offset + 32));
      offset += 32;

      const timestamp = this.readU64LE(buffer, offset);
      offset += 8;

      const virtualSolReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const virtualTokenReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const realSolReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const realTokenReserves = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const feeRecipient = bs58.encode(buffer.subarray(offset, offset + 32));
      offset += 32;

      const feeBps = buffer.readUInt16LE(offset);
      offset += 2;

      const fee = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const creator = bs58.encode(buffer.subarray(offset, offset + 32));
      offset += 32;

      const creatorFeeBps = buffer.readUInt16LE(offset);
      offset += 2;

      const creatorFee = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const trackVolume = buffer.readUInt8(offset) === 1;
      offset += 1;

      const totalUnclaimedTokens = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const totalClaimedTokens = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const currentSolVolume = this.readU64LE(buffer, offset) / 1e9;
      offset += 8;

      const lastUpdateTimestamp = this.readU64LE(buffer, offset);
      offset += 8;

      return {
        mint,
        solAmount,
        tokenAmount,
        isBuy,
        user,
        timestamp,
        virtualSolReserves,
        virtualTokenReserves,
        realSolReserves,
        realTokenReserves,
        feeRecipient,
        feeBps,
        fee,
        creator,
        creatorFeeBps,
        creatorFee,
        trackVolume,
        totalUnclaimedTokens,
        totalClaimedTokens,
        currentSolVolume,
        lastUpdateTimestamp,
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

  private computePriceSol(virtualSolReserves: number, virtualTokenReserves: number): number {
    if (!virtualSolReserves || !virtualTokenReserves) return 0;
    return (virtualSolReserves / virtualTokenReserves) * 1e6;
  }

  private formatUsd(value: number): string {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
  }

}