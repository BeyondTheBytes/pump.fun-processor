import { PumpFunEventType } from "src/modules/pump-fun/types/pump-fun-event.type";

export class EventClassifier {
  static classify(logs: string[]): PumpFunEventType {
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