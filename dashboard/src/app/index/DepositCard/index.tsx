import {Col, Divider, ExplorerLink, Row, StatusChip, Table, Text, TreeView} from '@/components';
import {DepositBatch} from '@/types';
import {shortenHex} from '@/utils/format';

import {Container, SectionTitle, SectionTitleContainer, TransactionCard} from './styled';

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
      <SectionTitleContainer as={Row} $justify="space-between" $alignItems="center">
        <Row $gap="xxsmall">
          <SectionTitle>Batch:</SectionTitle>
          <SectionTitle>{batchId && shortenHex(batchId, 8)}</SectionTitle>
        </Row>

        <StatusChip type="deposit" status={deposit.status} />
      </SectionTitleContainer>

      <Col $padding="small">
        <Table headings={['Recipient', 'Amount', 'Origin Tx']}>
          {deposit.deposits.map((batchDeposit) => (
            <tr key={batchDeposit.origin.hash}>
              <td>
                <ExplorerLink network="l2" address={batchDeposit.recipient}>
                  <Text.BodyStrong $color="inherit">{shortenHex(batchDeposit.recipient)}</Text.BodyStrong>
                </ExplorerLink>
              </td>

              <td>
                <Text.BodyStrong>{batchDeposit.amount.toString()}</Text.BodyStrong>
              </td>

              <td>
                <ExplorerLink tx={batchDeposit.origin}>
                  <Text.BodyStrong $color="inherit">{shortenHex(batchDeposit.origin.hash)}</Text.BodyStrong>
                </ExplorerLink>
              </td>
            </tr>
          ))}
        </Table>
      </Col>

      <Divider />

      <Col $padding="small" $gap="small">
        <Col $gap="xsmall">
          {deposit.aggregationTxs.length > 0 && (
            <>
              <Text.CardTitle>Aggregation Txs:</Text.CardTitle>

              <TreeView
                inverted
                items={deposit.aggregationTxs}
                keyExtractor={(aggregationTx) => aggregationTx.tx.hash}
                renderItem={(aggregationTx) => (
                  <TransactionCard $gap={4}>
                    <Row $justify="space-between" $alignItems="center" $gap="xsmall">
                      {aggregationTx.type === 'LEAF' && (
                        <Col>
                          <Text.CardValue>{aggregationTx.depositAmt.toString()}</Text.CardValue>
                        </Col>
                      )}

                      <Col $alignItems="flex-end">
                        {aggregationTx.type === 'LEAF' && (
                          <ExplorerLink network="l1" address={aggregationTx.depositAddress}>
                            <Text.CardValue $color="inherit">{shortenHex(aggregationTx.depositAddress)}</Text.CardValue>
                          </ExplorerLink>
                        )}

                        <ExplorerLink tx={aggregationTx.tx}>
                          <Text.CardValue $color="inherit">{shortenHex(aggregationTx.tx.hash)}</Text.CardValue>
                        </ExplorerLink>
                      </Col>
                    </Row>
                  </TransactionCard>
                )}
              />
            </>
          )}
          <Row $gap="xxlarge">
            <Col $gap="xxsmall" $justify="center">
              {finalizeBatchTx && <Text.CardTitle>Finalize Tx:</Text.CardTitle>}
              {depositTx && <Text.CardTitle>Deposit Tx:</Text.CardTitle>}
              {verifyTx && <Text.CardTitle>Verify Tx:</Text.CardTitle>}
            </Col>

            <Col $gap="xxsmall" $justify="center">
              {finalizeBatchTx && (
                <ExplorerLink tx={finalizeBatchTx}>
                  <Text.CardValue $color="inherit">{shortenHex(finalizeBatchTx.hash)}</Text.CardValue>
                </ExplorerLink>
              )}

              {depositTx && (
                <ExplorerLink tx={depositTx}>
                  <Text.CardValue $color="inherit">{shortenHex(depositTx.hash)}</Text.CardValue>
                </ExplorerLink>
              )}

              {verifyTx && (
                <ExplorerLink tx={verifyTx}>
                  <Text.CardValue $color="inherit">{shortenHex(verifyTx.hash)}</Text.CardValue>
                </ExplorerLink>
              )}
            </Col>
          </Row>
        </Col>
      </Col>
    </Container>
  );
};
