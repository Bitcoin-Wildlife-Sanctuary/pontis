import {loadState} from '@/utils/state';

import Page from './index';

export default async function StateJson() {
  const state = await loadState();

  return <Page initialState={state} />;
}
