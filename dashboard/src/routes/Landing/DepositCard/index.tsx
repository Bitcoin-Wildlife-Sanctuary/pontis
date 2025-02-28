import {Col, Divider, Icon, Row, Table, Text} from '../../../components';
import {DepositBatch} from '../../../types';
import {shortenHex, showDepositStatus, showTxStatus} from '../../../utils/format';
import {Container, SectionTitle, TransactionCard} from './styled';

type DepositCardProps = {
  deposit: DepositBatch;
};

export const DepositCard: React.FC<DepositCardProps> = ({deposit}) => {
  const batchId = 'batchId' in deposit ? deposit.batchId : undefined;
  const finalizeBatchTx = 'finalizeBatchTx' in deposit ? deposit.finalizeBatchTx : undefined;
  const depositTx = 'depositTx' in deposit ? deposit.depositTx : undefined;
  const verifyTx = 'verifyTx' in deposit ? deposit.verifyTx : undefined;

  return (
    <Container>
      <Row $gap="xxlarge">
        <Col $gap="xxsmall" $justify="center">
          <Text.CardTitle>Status:</Text.CardTitle>
          {batchId && <Text.CardTitle>Batch ID:</Text.CardTitle>}
          {finalizeBatchTx && <Text.CardTitle>Finalize Batch TX:</Text.CardTitle>}
          {depositTx && <Text.CardTitle>Deposit TX:</Text.CardTitle>}
          {verifyTx && <Text.CardTitle>Verify TX:</Text.CardTitle>}
        </Col>

        <Col $gap="xxsmall" $justify="center">
          <Text.CardValue>{showDepositStatus(deposit.status)}</Text.CardValue>
          {batchId && <Text.CardValue>{shortenHex(batchId, 8)}</Text.CardValue>}

          {finalizeBatchTx && (
            <Row $gap="small">
              <Text.CardValue>{showTxStatus(finalizeBatchTx.status)}</Text.CardValue>
              <Text.CardValue>{shortenHex(finalizeBatchTx.hash)}</Text.CardValue>
            </Row>
          )}

          {depositTx && (
            <Row $gap="small">
              <Text.CardValue>{showTxStatus(depositTx.status)}</Text.CardValue>
              <Text.CardValue>{shortenHex(depositTx.hash)}</Text.CardValue>
            </Row>
          )}

          {verifyTx && (
            <Row $gap="small">
              <Text.CardValue>{showTxStatus(verifyTx.status)}</Text.CardValue>
              <Text.CardValue>{shortenHex(verifyTx.hash)}</Text.CardValue>
            </Row>
          )}
        </Col>
      </Row>

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Deposits</SectionTitle>

      <Table headings={['Recipient', 'Amount', 'Origin TX']}>
        {deposit.deposits.map((batchDeposit) => (
          <tr key={batchDeposit.origin.hash}>
            <td>
              <a href="#">
                <Row $alignItems="center" $gap="xsmall">
                  <Text.BodyStrong $color="inherit">{shortenHex(batchDeposit.recipient)}</Text.BodyStrong>

                  <Icon name="ExternalLink" color="inherit" size={18} />
                </Row>
              </a>
            </td>

            <td>
              <Text.BodyStrong>{batchDeposit.amount.toString()}</Text.BodyStrong>
            </td>

            <td>
              <a href="#">
                <Row $alignItems="center" $gap="xsmall">
                  <Text.BodyStrong $color="inherit">{shortenHex(batchDeposit.origin.hash)}</Text.BodyStrong>

                  <Icon name="ExternalLink" color="inherit" size={18} />
                </Row>
              </a>
            </td>
          </tr>
        ))}
      </Table>

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Aggregation Transactions</SectionTitle>

      <Row $alignItems="center">
        {deposit.aggregationTxs.map((aggregationTxLevels, levelIdx) => (
          <>
            {levelIdx % 2 === 1 && <Icon name="DoubleArrowRight" color="border" width={33} height={87} />}

            <Col key={levelIdx.toString()} $gap="xxsmall">
              {aggregationTxLevels.map((aggregationTx) => (
                <TransactionCard key={aggregationTx.tx.hash} $gap={4}>
                  {aggregationTx.type === 'LEAF' && (
                    <>
                      <Row $gap="xlarge" $justify="space-between">
                        <Text.CardTitle>Amount:</Text.CardTitle>
                        <Text.CardValue>{aggregationTx.depositAmt.toString()}</Text.CardValue>
                      </Row>

                      <Row $gap="xlarge" $justify="space-between">
                        <Text.CardTitle>Address:</Text.CardTitle>
                        <Text.CardValue>{shortenHex(aggregationTx.depositAddress)}</Text.CardValue>
                      </Row>
                    </>
                  )}

                  <Row $gap="xlarge" $justify="space-between">
                    <Text.CardTitle>Status:</Text.CardTitle>
                    <Text.CardValue>{showTxStatus(aggregationTx.tx.status)}</Text.CardValue>
                  </Row>

                  <Row $gap="xlarge" $justify="space-between">
                    <Text.CardTitle>TX Hash:</Text.CardTitle>
                    <Text.CardValue>{shortenHex(aggregationTx.tx.hash)}</Text.CardValue>
                  </Row>
                </TransactionCard>
              ))}
            </Col>
          </>
        ))}
      </Row>
    </Container>
  );
};
