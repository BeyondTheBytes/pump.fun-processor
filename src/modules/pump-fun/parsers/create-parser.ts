import { PublicKey } from "@solana/web3.js";
import { PumpFunEventType } from "../types/pump-fun-event.type";

export class CreateParser {
  static parseFromLogs(
    logs: string[],
    programId: PublicKey,
    baseData: { signature: string; slot: number; timestamp: Date }
  ) {
    try {
      const programDataLog = logs.find((l) => l.startsWith("Program data:"));
      if (!programDataLog) {
        console.warn(`[CreateParser] Nenhum "Program data" encontrado para ${baseData.signature}`);
        return { type: PumpFunEventType.CREATE, complete: false, ...baseData };
      }

      const base64Data = programDataLog.replace("Program data:", "").trim();
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length < 8) {
        console.warn(`[CreateParser] Program data too short: ${buffer.length}`);
        return { type: PumpFunEventType.CREATE, complete: false, ...baseData };
      }

      let offset = 8; // pula o discriminator (8 bytes padrão Anchor)

      const safeReadU32 = (): number => {
        if (offset + 4 > buffer.length) throw new Error("Out of range while reading u32");
        const v = buffer.readUInt32LE(offset);
        offset += 4;
        return v;
      };

      const safeReadString = (): string => {
        const len = safeReadU32();
        if (len > 1024) throw new Error(`Invalid string length (${len})`);
        if (offset + len > buffer.length) throw new Error("Out of range while reading string");
        const str = buffer.subarray(offset, offset + len).toString("utf8");
        offset += len;
        return str;
      };

      const safeReadPubkey = (): string => {
        if (offset + 32 > buffer.length) throw new Error("Out of range while reading pubkey");
        const pk = new PublicKey(buffer.subarray(offset, offset + 32)).toBase58();
        offset += 32;
        return pk;
      };

      // ---- layout manual baseado no PumpFun create ----
      const name = safeReadString();
      const symbol = safeReadString();
      const uri = safeReadString();
      const mint = safeReadPubkey();
      const bondingCurve = safeReadPubkey();

      // ⚠️ Novo: o criador vem logo após o bondingCurve
      let creator: string | undefined;
      if (offset + 32 <= buffer.length) {
        creator = safeReadPubkey();
      }

      // se chegou até aqui, é um create completo
      return {
        type: PumpFunEventType.CREATE,
        complete: true,
        name,
        symbol,
        uri,
        mint,
        bondingCurve,
        creator,
        ...baseData,
      };
    } catch (err: any) {
      // Erros tratados e logados, mas o worker continua
      console.error(
        `[CreateParser] Error decoding base64 program data: ${err.message}`
      );
      return { type: PumpFunEventType.CREATE, complete: false, ...baseData };
    }
  }
}
