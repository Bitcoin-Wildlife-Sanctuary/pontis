import { readFileSync, writeFileSync } from 'fs';
import { OperatorState } from './state';

function deepCloneWithoutToJSON(obj: any): any {
  if (obj && typeof obj === 'object') {
    const clone: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        let val = obj[key];
        // If the property is an object and has a toJSON method, remove it.
        if (val && typeof val === 'bigint') {
          // Create a shallow clone to remove the toJSON method.
          val = `${val}n`;
        }
        clone[key] = deepCloneWithoutToJSON(val);
      }
    }
    return clone;
  }
  return obj;
}

export function stringify(state: OperatorState): string {
  return JSON.stringify(
    deepCloneWithoutToJSON(state),
    (_, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n';
      }
      return value;
    },
    2
  );
}

export function save(path: string, state: OperatorState) {
  writeFileSync(path, stringify(state), 'utf8');
}

export function load(path: string): OperatorState {
  const rawData = readFileSync(path, 'utf8');

  const state = JSON.parse(rawData, (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  });
  return state as OperatorState;
}
