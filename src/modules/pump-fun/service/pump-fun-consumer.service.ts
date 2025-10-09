import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Connection, PublicKey } from "@solana/web3.js";
import { Job } from "bullmq";
import { CreateParser } from "src/modules/pump-fun/parsers/create-parser";
import { PumpFunEventType } from "src/modules/pump-fun/types/pump-fun-event.type";
import { EventClassifier } from "src/modules/pump-fun/utils/event-classifier";
import { TokenPrismaRepository } from "../db/repositories/prisma/token.prisma.repository";

@Processor('pump-fun-event', { concurrency: 10, limiter: { max: 10, duration: 1000 } })
export class PumpFunConsumerService extends WorkerHost {
  private connection: Connection
  private readonly PUMP_FUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

  constructor(
    private readonly tokenRepository: TokenPrismaRepository,
  ) {
    super();
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
          await this.tokenRepository.saveToken(parsedEvent)
          console.log(parsedEvent);
          break
        }

        case PumpFunEventType.TRADE:
          console.log(logs);
          return { status: 'skipped', reason: 'trade_event_not_implemented' };
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
    // const lightweightData = this.parseFromLogs(logs);

    // if (lightweightData.complete) return { ...lightweightData, ...baseData };

    const tx = await this.safeGetTransaction(signature);
    if (!tx) return null;

    return CreateParser.parse(tx, this.PUMP_FUN_PROGRAM_ID, baseData);
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