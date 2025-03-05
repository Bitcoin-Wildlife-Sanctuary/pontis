'use client';

import {useEffect, useState} from 'react';

export const usePageVisibility = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const listener = () => {
      if (document.visibilityState !== 'visible') {
        setVisible(false);
      } else {
        setVisible(true);
      }
    };

    document.addEventListener('visibilitychange', listener);

    return () => {
      document.removeEventListener('visibilitychange', listener);
    };
  }, []);

  return visible;
};
