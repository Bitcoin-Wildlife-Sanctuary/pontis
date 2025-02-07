
import fetch from 'cross-fetch';
export async function getBlockNumber(): Promise<number> {
  const url = 'https://explorer.bc-2.jp/api/blocks'
  const response = await fetch(url);
  const data: any = await response.json();
  return data[0].height;
}
