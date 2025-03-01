import fs from 'node:fs/promises';

import {OperatorState} from '@/types';

import {OPERATOR_STATE_PATH} from './env';

export const loadState = async (): Promise<OperatorState> => {
  const rawState = await fs.readFile(OPERATOR_STATE_PATH, 'utf-8');
  return JSON.parse(rawState);
};

export const watchState = async (ac: AbortController, callback: () => void) => {
  const watcher = fs.watch(OPERATOR_STATE_PATH, {signal: ac.signal});

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of watcher) {
    callback();
  }
};
