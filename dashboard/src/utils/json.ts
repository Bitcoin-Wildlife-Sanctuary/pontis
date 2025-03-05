import type {OperatorState} from '@/types';

export function parseOperatorState(raw: string): OperatorState {
  return JSON.parse(raw, (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }

    return value;
  });
}
