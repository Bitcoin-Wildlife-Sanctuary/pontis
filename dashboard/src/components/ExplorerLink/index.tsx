import {useMemo} from 'react';

import {L1Tx, L2Tx, Theme} from '@/types';
import {L1_EXPLORER_LINK, L2_EXPLORER_LINK} from '@/utils/envPublic';
import {getTransactionStatusType} from '@/utils/format';

import {Row} from '../Layout';
import {StyledIcon, StyledTransactionStatus} from './styled';

type ExplorerLinkProps = {
  children: React.ReactNode;
  iconGap?: number | keyof Theme['spacings'];
  iconSize?: number;
} & (
  | {
      tx?: Omit<L1Tx | L2Tx, 'status'> & Partial<Pick<L1Tx | L2Tx, 'status'>>;
    }
  | {
      network: 'l1' | 'l2';
      address: string;
    }
);

export const ExplorerLink: React.FC<ExplorerLinkProps> = ({children, iconGap = 'xsmall', iconSize = 18, ...props}) => {
  const tx = 'tx' in props ? props.tx : undefined;
  const network = 'network' in props ? props.network : undefined;
  const address = 'address' in props ? props.address : undefined;

  const href = useMemo(() => {
    if (tx) {
      return `${tx.type === 'l1tx' ? L1_EXPLORER_LINK : L2_EXPLORER_LINK}/tx/${tx.hash}`;
    }

    if (network === 'l1') {
      return `${L1_EXPLORER_LINK}/address/${address}`;
    }

    if (network === 'l2') {
      return `${L2_EXPLORER_LINK}/contract/${address}`;
    }

    return '';
  }, [tx, network, address]);

  return (
    <a href={href} target="_blank" rel="noreferrer">
      <Row $alignItems="center" $gap={iconGap}>
        {tx && tx.status ? <StyledTransactionStatus $status={getTransactionStatusType(tx.status)} /> : null}

        {children}

        {href && <StyledIcon name="ExternalLink" color="inherit" size={iconSize} />}
      </Row>
    </a>
  );
};
