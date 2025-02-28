import {Col, Divider, Icon, Row, Table, Text} from '../../../components';
import {WithdrawalBatch} from '../../../types';
import {shortenHex, showTxStatus, showWithdrawalStatus} from '../../../utils/format';
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
            <Row $gap="small">
              <Text.CardValue>{showTxStatus(closeTx.status)}</Text.CardValue>
              <Text.CardValue>{shortenHex(closeTx.hash)}</Text.CardValue>
            </Row>
          )}
        </Col>
      </Row>

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Withdrawals</SectionTitle>

      <Table headings={['Recipient', 'Amount', 'Origin TX']}>
        {withdrawal.withdrawals.map((batchWithdrawal) => (
          <tr key={batchWithdrawal.origin}>
            <td>
              <a href="#">
                <Row $alignItems="center" $gap="xsmall">
                  <Text.BodyStrong $color="inherit">{shortenHex(batchWithdrawal.recipient)}</Text.BodyStrong>

                  <Icon name="ExternalLink" color="inherit" size={18} />
                </Row>
              </a>
            </td>

            <td>
              <Text.BodyStrong>{batchWithdrawal.amount.toString().replace('n', '')}</Text.BodyStrong>
            </td>

            <td>
              <a href="#">
                <Row $alignItems="center" $gap="xsmall">
                  <Text.BodyStrong $color="inherit">{shortenHex(batchWithdrawal.origin)}</Text.BodyStrong>

                  <Icon name="ExternalLink" color="inherit" size={18} />
                </Row>
              </a>
            </td>
          </tr>
        ))}
      </Table>
    </Container>
  );
};
