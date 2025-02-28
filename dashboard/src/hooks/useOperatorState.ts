import {useQuery} from '@tanstack/react-query';

import {OperatorState} from '../types';

export const useOperatorState = () => {
  return useQuery({
    queryKey: ['state'],
    queryFn: async () => {
      const response = await fetch('/state.json');
      const json = await response.json();

      return json as OperatorState;
    },
  });
};
