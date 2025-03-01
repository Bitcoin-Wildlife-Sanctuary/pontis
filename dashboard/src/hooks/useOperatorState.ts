import {useQuery} from '@tanstack/react-query';

import {OperatorState} from '../types';
import {OPERATOR_API_URL} from '../utils/env';

export const useOperatorState = () => {
  return useQuery({
    queryKey: ['state'],
    queryFn: async () => {
      const response = await fetch(`${OPERATOR_API_URL}/state`, {
        signal: AbortSignal.timeout(5_000),
      });
      const json = await response.json();

      return json as OperatorState;
    },
  });
};
