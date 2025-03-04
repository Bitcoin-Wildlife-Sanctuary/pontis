'use client';

import ReactJson from 'react-json-view';
import {useTheme} from 'styled-components';

import {useAutoUpdateState} from '@/hooks';
import {StateWithDate} from '@/types';

export default function Page({initialState}: {initialState: StateWithDate}) {
  const {state, lastUpdate} = useAutoUpdateState(initialState);

  const theme = useTheme();

  return <ReactJson theme="chalk" style={{padding: theme.spacings.small}} src={{lastUpdate, state}} />;
}
