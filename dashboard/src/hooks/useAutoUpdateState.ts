'use client';

import {useEffect, useState} from 'react';

import {StateWithDate} from '@/types';

export const useAutoUpdateState = (initialState: StateWithDate) => {
  const [state, setState] = useState(initialState);

  useEffect(() => {
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

          if (data.state && typeof data.state === 'object') {
            setState({
              state: data.state,
              lastUpdate: new Date(data.timestamp) || new Date(),
            });
          }

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
  }, []);

  return state;
};
