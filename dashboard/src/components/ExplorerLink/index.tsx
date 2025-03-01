import {useMemo} from 'react';

import {L1Tx, L2Tx, Theme} from '@/types';
import {getStatusType} from '@/utils/format';

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
    const l1BaseUrl = 'https://btcscan.org';
    const l2BaseUrl = 'https://starkscan.co';

    if (tx) {
      return `${tx.type === 'l1tx' ? l1BaseUrl : l2BaseUrl}/tx/${tx.hash}`;
    }

    if (network === 'l1') {
      return `${l1BaseUrl}/address/${address}`;
    }

    if (network === 'l2') {
      return `${l2BaseUrl}/contract/${address}`;
    }

    return '';
  }, [tx, network, address]);

  return (
    <a href={href} target="_blank" rel="noreferrer">
      <Row $alignItems="center" $gap={iconGap}>
        {tx && tx.status ? <StyledTransactionStatus $status={getStatusType(tx.status)} /> : null}

        {children}

        {href && <StyledIcon name="ExternalLink" color="inherit" size={iconSize} />}
      </Row>
    </a>
  );
};
