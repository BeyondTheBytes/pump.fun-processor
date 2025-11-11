import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/prisma/services/prisma.service";

@Injectable()
export class TokenPrismaRepository {
  constructor(private readonly prisma: PrismaService) { }

  async saveToken(data: any) {
    return await this.prisma.token.create({
      data: {
        signature: data.signature,
        type: data.type,

        name: data.name,
        symbol: data.symbol,
        creator: data.creator,
        bodingCurve: data.bondingCurve,

        action: data.action,
        solAmonut: data.solAmount,
        tokenAmount: data.tokenAmount,

        mint: data.mint,

        slot: data.slot,
        timestamp: data.timestamp,
      }
    })
  }

  async saveCreateTokenEvent(data: any) {
    return await this.prisma.createdTokenEvent.create({
      data: {
        type: data.type,
        signature: data.signature,

        name: data.name,
        symbol: data.symbol,
        creator: data.creator,
        bondingCurve: data.bondingCurve,

        uri: data.uri,

        mint: data.mint,
        slot: data.slot,
        timestamp: data.timestamp,
      }
    })
  }

  async getTokenByMint(mint: string) {
    return await this.prisma.createdTokenEvent.findFirst({
      where: { mint },
      orderBy: { timestamp: 'desc' },
    });
  }

  async saveTradeEvent(data: any) {
    return await this.prisma.tradeTokenEvent.create({
      data: {
        signature: data.signature,
        type: data.type,
        slot: data.slot,
        timestamp: data.timestamp,
        mint: data.mint,
        action: data.action,
        solAmount: data.solAmount,
        tokenAmount: data.tokenAmount,
        isBuy: data.isBuy,
        virtualSolReserves: data.virtualSolReserves,
        virtualTokenReserves: data.virtualTokenReserves,
        realSolReserves: data.realSolReserves,
        realTokenReserves: data.realTokenReserves,
        programData: data.programData,
      }
    })
  }

  async saveGraduationEvent(data: any) {
    return await this.prisma.graduationTokenEvent.create({
      data: {
        type: data.type,
        signature: data.signature,
        slot: data.slot,
        timestamp: data.timestamp,
        mint: data.tokenMint,
        bodingCurve: data.bondingCurve,
        wsolMint: data.wsolMint,
        poolAuthority: data.poolAuthority,
      }
    })
  }

  async getCurrentAth(mint: string) {
    return await this.prisma.tokenAthCurrent.findUnique({ where: { mint } });
  }

  async existsCreatedToken(mint: string): Promise<boolean> {
    const count = await this.prisma.createdTokenEvent.count({
      where: { mint }
    });
    return count > 0;
  }

  async upsertCurrentAth(data: { mint: string, priceSol: number, priceUsd?: number }) {
    await this.prisma.tokenAthCurrent.upsert({
      where: { mint: data.mint },
      update: {
        priceSol: data.priceSol,
        priceUsd: data.priceUsd ?? null,
      },
      create: {
        mint: data.mint,
        priceSol: data.priceSol,
        priceUsd: data.priceUsd ?? null,
      }
    })
  }

  async insertAthHistory(data: { mint: string, priceSol: number, signature: string, slot: bigint, timestamp: Date }) {
    return await this.prisma.tokenAthHistory.create({
      data: {
        mint: data.mint,
        slot: data.slot,
        priceSol: data.priceSol,
        signature: data.signature,
        timestamp: data.timestamp,
      }
    });
  }
}