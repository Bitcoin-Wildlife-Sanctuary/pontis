import {loadState} from '@/utils/state';

import Page from './index';

export default async function Home() {
  const state = await loadState();

  return <Page initialState={state} />;
}
