import fs from 'node:fs/promises';

import {StateWithDate} from '@/types';

import {ABSOLUTE_OPERATOR_STATE_PATH} from './constants';

export const loadState = async (): Promise<StateWithDate> => {
  const rawState = await fs.readFile(ABSOLUTE_OPERATOR_STATE_PATH, 'utf-8');
  const state = JSON.parse(rawState);

  const stat = await fs.stat(ABSOLUTE_OPERATOR_STATE_PATH);

  return {
    state,
    lastUpdate: stat.mtime,
  };
};

export const watchState = async (ac: AbortController, callback: () => void) => {
  const watcher = fs.watch(ABSOLUTE_OPERATOR_STATE_PATH, {signal: ac.signal});

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of watcher) {
    callback();
  }
};
