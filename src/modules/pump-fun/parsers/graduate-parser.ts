import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { PumpFunEventType } from "../types/pump-fun-event.type";

export interface GraduationEvent {
  type: "GraduationEvent";
  signature: string;
  slot: number;
  timestamp: Date;
  rawProgramData: string;
  lamports: bigint;
  solAmount: number;
  poolAuthority: string;
  tokenMint: string;
  wsolMint: string;
  bondingCurve: string;
}

export class GraduationParser {
  private static readPubkey(buf: Buffer, offset: number): [string, number] {
    const pk = bs58.encode(buf.subarray(offset, offset + 32));
    return [pk, offset + 32];
  }


  static decodeProgramDataMinimal(base64Data: string) {
    const buf = Buffer.from(base64Data, "base64");
    let offset = 0;

    offset += 8;

    const lamports = buf.readBigUInt64LE(offset);
    const solAmount = Number(lamports) / 1e9;
    offset += 8;

    offset += 2;

    let poolAuthority: string, tokenMint: string, wsolMint: string;
    [poolAuthority, offset] = this.readPubkey(buf, offset);
    [tokenMint, offset] = this.readPubkey(buf, offset);
    [wsolMint, offset] = this.readPubkey(buf, offset);

    return {
      lamports,
      solAmount,
      poolAuthority,
      tokenMint,
      wsolMint,
    };
  }

  static parse(
    logs: string[],
    programId: string | PublicKey,
    signature: string,
    slot: number,
    timestampMs: number
  ): GraduationEvent | null {
    console.log('--------------------');
    console.log(programId);


    const programDataLog = logs.find((l) => l.startsWith("Program data: "));
    if (!programDataLog) return null;

    const base64Match = programDataLog.match(/Program data:\s+(.+)/);
    if (!base64Match) return null;

    const base64Data = base64Match[1];

    try {
      const decoded = this.decodeProgramDataMinimal(base64Data);

      const prog = typeof programId === "string" ? new PublicKey(programId) : programId;

      const mintPubKey = new PublicKey(decoded.tokenMint);
      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding-curve"), mintPubKey.toBuffer()],
        prog
      );

      const event: GraduationEvent = {
        type: PumpFunEventType.GRADUATION,
        signature,
        slot,
        timestamp: new Date(timestampMs),
        rawProgramData: base64Data,
        lamports: decoded.lamports,
        solAmount: decoded.solAmount,
        poolAuthority: decoded.poolAuthority,
        tokenMint: decoded.tokenMint,
        wsolMint: decoded.wsolMint,
        bondingCurve: bondingCurvePda.toBase58(),
      };

      return event;
    } catch (err) {
      console.error("GraduationParser.parse error:", err);
      return null;
    }
  }
}
