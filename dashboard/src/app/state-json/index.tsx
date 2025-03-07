'use client';

import dynamic from 'next/dynamic';
import {useTheme} from 'styled-components';

import {useAutoUpdateState} from '@/hooks';
import {StateWithDate} from '@/types';

const DynamicReactJson = dynamic(() => import('react-json-view'), {
  ssr: false,
});

export default function Page({initialState}: {initialState: StateWithDate}) {
  const {state, lastUpdate} = useAutoUpdateState(initialState, false);

  const theme = useTheme();

  return <DynamicReactJson theme="chalk" style={{padding: theme.spacings.small}} src={{lastUpdate, state}} />;
}
