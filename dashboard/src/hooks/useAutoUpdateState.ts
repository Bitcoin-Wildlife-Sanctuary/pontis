'use client';

import {useEffect, useState} from 'react';

import {StateWithDate} from '@/types';
import {parseOperatorState} from '@/utils/json';

import {usePageVisibility} from './usePageVisibility';

export const useAutoUpdateState = (initialState: StateWithDate, parse = true) => {
  const [state, setState] = useState<StateWithDate>(() => {
    return {
      lastUpdate: initialState.lastUpdate,
      state: parse ? parseOperatorState(JSON.stringify(initialState.state)) : initialState.state,
    };
  });

  const visible = usePageVisibility();

  useEffect(() => {
    if (!visible) return;

    const event = new EventSource('/api/listen-state');

    event.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);

        if (data.message === 'connected') {
          console.log('Connected to state updates');
          return;
        }

        if (data.message === 'state-change') {
          console.log('State change:', data.state);

          // If the received state is not an object, ignore it.
          if (!data.state || typeof data.state !== 'object') {
            return;
          }

          setState({
            state: parse ? parseOperatorState(JSON.stringify(data.state)) : data.state,
            lastUpdate: new Date(data.timestamp) || new Date(),
          });

          return;
        }
      } catch (error) {
        console.error('Error parsing message:', message.data);
        return;
      }
    };

    return () => {
      event.close();
    };
  }, [visible, parse]);

  return state;
};
