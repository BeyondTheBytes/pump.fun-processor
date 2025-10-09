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
}