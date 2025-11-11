import { PumpFunEventType } from "src/modules/pump-fun/types/pump-fun-event.type";

export class EventClassifier {
  static classify(logs: string[]): PumpFunEventType {
    if (logs.some(l => l.includes('Instruction: CreatePool'))) {
      return PumpFunEventType.GRADUATION;
    }
    if (
      logs.some(l => l.includes('Instruction: Migrate')) &&
      !logs.some(l => l.includes('Bonding curve already migrated'))
    ) {
      return PumpFunEventType.GRADUATION;
    }
    if (logs.includes('Program log: Instruction: Create')) {
      return PumpFunEventType.CREATE;
    }
    if (logs.includes('Program log: Instruction: Buy') ||
      logs.includes('Program log: Instruction: Sell')) {
      return PumpFunEventType.TRADE;
    }
    return PumpFunEventType.UNKNOWN;
  }
}