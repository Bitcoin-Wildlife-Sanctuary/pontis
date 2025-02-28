import {useMemo} from 'react';

import {Theme} from '../../types';
import {Icon} from '../Icon';
import {Row} from '../Layout';

type ExplorerLinkProps = {
  children: React.ReactNode;
  network: 'l1' | 'l2';
  type: 'tx' | 'address';
  value: string;
  iconGap?: number | keyof Theme['spacings'];
  iconSize?: number;
};

export const ExplorerLink: React.FC<ExplorerLinkProps> = ({
  children,
  network,
  type,
  value,
  iconGap = 'xsmall',
  iconSize = 18,
}) => {
  const href = useMemo(() => {
    const baseUrl = network === 'l1' ? 'https://btcscan.org' : 'https://starkscan.co';

    if (type === 'tx') {
      return `${baseUrl}/tx/${value}`;
    }

    if (type === 'address' && network === 'l1') {
      return `${baseUrl}/address/${value}`;
    }

    return `${baseUrl}/contract/${value}`;
  }, [network, type, value]);

  return (
    <a href={href} target="_blank" rel="noreferrer">
      <Row $alignItems="center" $gap={iconGap}>
        {children}

        <Icon name="ExternalLink" color="inherit" size={iconSize} />
      </Row>
    </a>
  );
};
