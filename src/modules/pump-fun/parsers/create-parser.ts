import { PublicKey, VersionedTransactionResponse } from '@solana/web3.js';
import { PumpFunEventType } from 'src/modules/pump-fun/types/pump-fun-event.type';
import { BufferReader } from 'src/modules/pump-fun/utils/buffer-reader';

export class CreateParser {
  static parse(tx: VersionedTransactionResponse, programId: PublicKey, baseData: any) {
    try {
      const pumpInstruction = tx.transaction.message.compiledInstructions.find((instr) => {
        const instrProgramId = tx.transaction.message.staticAccountKeys[instr.programIdIndex];
        return instrProgramId.equals(programId);
      })

      if (!pumpInstruction) return null;

      const dataBuffer = Buffer.from(pumpInstruction.data);

      const bufferReader = new BufferReader(dataBuffer);

      const tokenName = bufferReader.readLengthPrefixedString().value;
      const symbol = bufferReader.readLengthPrefixedString().value;
      const uri = bufferReader.readLengthPrefixedString().value;

      const accountKeys = tx.transaction.message.staticAccountKeys;

      const mint = accountKeys[1].toBase58();
      const [bondingCurve] = PublicKey.findProgramAddressSync([
        Buffer.from("bonding-curve"),
        new PublicKey(mint).toBuffer(),
      ],
        programId
      )
      const user = accountKeys[0].toBase58();

      return {
        type: PumpFunEventType.CREATE,
        mint,
        name: tokenName,
        symbol,
        uri,
        bondingCurve: bondingCurve.toBase58(),
        creator: user,
        ...baseData,
      };
    } catch (error) {
      console.error('Error parsing CREATE event:', error);
      return null;
    }
  }
}