import fs from 'node:fs/promises';

import {OperatorState} from '@/types';

import {ABSOLUTE_OPERATOR_STATE_PATH} from './constants';

export const loadState = async (): Promise<OperatorState> => {
  const rawState = await fs.readFile(ABSOLUTE_OPERATOR_STATE_PATH, 'utf-8');
  return JSON.parse(rawState);
};

export const watchState = async (ac: AbortController, callback: () => void) => {
  const watcher = fs.watch(ABSOLUTE_OPERATOR_STATE_PATH, {signal: ac.signal});

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of watcher) {
    callback();
  }
};
