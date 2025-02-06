import { IS_LOCAL } from "./env";

export function sleep(seconds: number) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function sleepTxTime() {
  return await sleep(IS_LOCAL ? 0 : 5)
}