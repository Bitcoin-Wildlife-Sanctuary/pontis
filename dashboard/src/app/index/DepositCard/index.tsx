import {Fragment} from 'react';

import {Col, Divider, ExplorerLink, Row, Table, Text, TreeView} from '@/components';
import {DepositBatch} from '@/types';
import {shortenHex, showDepositStatus} from '@/utils/format';

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
      <Row $justify="space-between">
        <Row $gap="xxsmall">
          <SectionTitle>Batch:</SectionTitle>
          <SectionTitle>{batchId && shortenHex(batchId, 8)}</SectionTitle>
        </Row>

        <Col>
          <SectionTitle>{showDepositStatus(deposit.status)}</SectionTitle>
        </Col>
      </Row>

      <Table headings={['Recipient', 'Amount', 'Origin TX']}>
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

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Transaction Informations</SectionTitle>

      <Col $gap="xsmall">
        <Row $gap="xxlarge">
          <Col $gap="xxsmall" $justify="center">
            {finalizeBatchTx && <Text.CardTitle>Finalize:</Text.CardTitle>}
            {depositTx && <Text.CardTitle>Deposit:</Text.CardTitle>}
            {verifyTx && <Text.CardTitle>Verify:</Text.CardTitle>}
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

        {deposit.aggregationTxs.length > 0 && (
          <TreeView>
            {deposit.aggregationTxs.map((aggregationTxLevels, levelIdx) => (
              <Fragment key={levelIdx.toString()}>
                {levelIdx % 2 === 1 && <TreeView.Separator />}

                <Col $gap="xxsmall">
                  {aggregationTxLevels.map((aggregationTx) => (
                    <TransactionCard key={aggregationTx.tx.hash} $gap={4}>
                      <Row $justify="space-between" $alignItems="center" $gap="xsmall">
                        {aggregationTx.type === 'LEAF' && (
                          <Col>
                            <Text.CardValue>{aggregationTx.depositAmt.toString()}</Text.CardValue>
                          </Col>
                        )}

                        <Col $alignItems="flex-end">
                          {aggregationTx.type === 'LEAF' && (
                            <ExplorerLink network="l1" address={aggregationTx.depositAddress}>
                              <Text.CardValue $color="inherit">
                                {shortenHex(aggregationTx.depositAddress)}
                              </Text.CardValue>
                            </ExplorerLink>
                          )}

                          <ExplorerLink tx={aggregationTx.tx}>
                            <Text.CardValue $color="inherit">{shortenHex(aggregationTx.tx.hash)}</Text.CardValue>
                          </ExplorerLink>
                        </Col>
                      </Row>
                    </TransactionCard>
                  ))}
                </Col>
              </Fragment>
            ))}
          </TreeView>
        )}
      </Col>
    </Container>
  );
};
