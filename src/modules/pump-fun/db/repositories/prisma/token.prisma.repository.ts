import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/prisma/services/prisma.service";

@Injectable()
export class TokenPrismaRepository {
  constructor(private readonly prisma: PrismaService) { }

  async saveToken(data: any) {
    await this.prisma.token.create({
      data: {
        type: data.type,
        mint: data.mint,
        name: data.name,
        symbol: data.symbol,
        creator: data.creator,
        signature: data.signature,
        slot: data.slot,
        timestamp: data.timestamp,
      }
    })
  }
}