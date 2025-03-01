import {Col, Divider, ExplorerLink, Row, Table, Text} from '@/components';
import {WithdrawalBatch} from '@/types';
import {shortenHex, showWithdrawalStatus} from '@/utils/format';

import {Container, SectionTitle} from './styled';

type WithdrawalCardProps = {
  withdrawal: WithdrawalBatch;
};

export const WithdrawalCard: React.FC<WithdrawalCardProps> = ({withdrawal}) => {
  const hash = 'hash' in withdrawal ? withdrawal.hash : undefined;
  const closeTx = 'closeWithdrawalBatchTx' in withdrawal ? withdrawal.closeWithdrawalBatchTx : undefined;

  return (
    <Container>
      <Row $gap="xxlarge">
        <Col $gap="xxsmall" $justify="center">
          <Text.CardTitle>Status:</Text.CardTitle>
          <Text.CardTitle>ID:</Text.CardTitle>
          {hash && <Text.CardTitle>Hash:</Text.CardTitle>}
          {closeTx && <Text.CardTitle>Close TX:</Text.CardTitle>}
        </Col>

        <Col $gap="xxsmall" $justify="center">
          <Text.CardValue>{showWithdrawalStatus(withdrawal.status)}</Text.CardValue>
          <Text.CardValue>{withdrawal.id.toString()}</Text.CardValue>
          {hash && <Text.CardValue>{shortenHex(hash, 10)}</Text.CardValue>}

          {closeTx && (
            <ExplorerLink tx={closeTx}>
              <Text.CardValue $color="inherit">{shortenHex(closeTx.hash)}</Text.CardValue>
            </ExplorerLink>
          )}
        </Col>
      </Row>

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Withdrawals</SectionTitle>

      <Table headings={['Recipient', 'Amount', 'Origin TX']}>
        {withdrawal.withdrawals.map((batchWithdrawal) => (
          <tr key={batchWithdrawal.origin}>
            <td>
              <ExplorerLink network="l1" address={batchWithdrawal.recipient}>
                <Text.BodyStrong $color="inherit">{shortenHex(batchWithdrawal.recipient)}</Text.BodyStrong>
              </ExplorerLink>
            </td>

            <td>
              <Text.BodyStrong>{batchWithdrawal.amount.toString().replace('n', '')}</Text.BodyStrong>
            </td>

            <td>
              <ExplorerLink tx={{type: 'l2tx', hash: batchWithdrawal.origin}}>
                <Text.BodyStrong $color="inherit">{shortenHex(batchWithdrawal.origin)}</Text.BodyStrong>
              </ExplorerLink>
            </td>
          </tr>
        ))}
      </Table>
    </Container>
  );
};
