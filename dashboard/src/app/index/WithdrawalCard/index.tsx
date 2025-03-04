import {Fragment} from 'react';

import {Col, Divider, ExplorerLink, Row, Table, Text, TreeView} from '@/components';
import {WithdrawalBatch} from '@/types';
import {shortenHex, showWithdrawalStatus} from '@/utils/format';

import {Container, SectionTitle, SectionTitleContainer, TransactionCard} from './styled';

type WithdrawalCardProps = {
  withdrawal: WithdrawalBatch;
};

export const WithdrawalCard: React.FC<WithdrawalCardProps> = ({withdrawal}) => {
  const hash = 'hash' in withdrawal ? withdrawal.hash : undefined;
  const closeTx = 'closeWithdrawalBatchTx' in withdrawal ? withdrawal.closeWithdrawalBatchTx : undefined;
  const withdrawBatchTx = 'withdrawBatchTx' in withdrawal ? withdrawal.withdrawBatchTx : undefined;
  const expansionTxs = 'expansionTxs' in withdrawal ? withdrawal.expansionTxs : undefined;

  return (
    <Container>
      <SectionTitleContainer as={Row} $justify="space-between" $gap="none">
        <Col $gap="xxsmall">
          <Row $gap="xxsmall">
            <SectionTitle>Batch:</SectionTitle>
            <SectionTitle>{withdrawal.id.toString()}</SectionTitle>
          </Row>

          <Row $gap="xxsmall">
            <SectionTitle>Hash:</SectionTitle>
            <SectionTitle>{shortenHex(hash, 10)}</SectionTitle>
          </Row>
        </Col>

        <SectionTitle>{showWithdrawalStatus(withdrawal.status)}</SectionTitle>
      </SectionTitleContainer>

      <Col $padding="small">
        <Table headings={['Recipient', 'Amount', 'Origin Tx']}>
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
      </Col>

      <Divider />

      <Col $padding="small" $gap="small">
        <SectionTitle>Transactions</SectionTitle>

        <Col $gap="xsmall">
          <Row $gap="xxlarge">
            <Col $gap="xxsmall" $justify="center">
              {closeTx && <Text.CardTitle>Close Tx:</Text.CardTitle>}
              {withdrawBatchTx && <Text.CardTitle>Withdraw Batch Tx:</Text.CardTitle>}
            </Col>

            <Col $gap="xxsmall" $justify="center">
              {closeTx && (
                <ExplorerLink tx={closeTx}>
                  <Text.CardValue $color="inherit">{shortenHex(closeTx.hash)}</Text.CardValue>
                </ExplorerLink>
              )}

              {withdrawBatchTx && (
                <ExplorerLink tx={withdrawBatchTx}>
                  <Text.CardValue $color="inherit">{shortenHex(withdrawBatchTx.hash)}</Text.CardValue>
                </ExplorerLink>
              )}
            </Col>
          </Row>

          {expansionTxs && expansionTxs.length > 0 && (
            <>
              <Text.CardTitle>Expansion Txs:</Text.CardTitle>
              <TreeView>
                {expansionTxs.map((expansionTxLevel, levelIdx) => (
                  <Fragment key={levelIdx.toString()}>
                    {levelIdx % 2 === 1 && <TreeView.Separator />}

                    <Col $gap="xxsmall">
                      {expansionTxLevel.map((expansionTx) => (
                        <TransactionCard key={expansionTx.hash} $gap={4}>
                          <ExplorerLink tx={expansionTx}>
                            <Text.CardValue $color="inherit">{shortenHex(expansionTx.hash)}</Text.CardValue>
                          </ExplorerLink>
                        </TransactionCard>
                      ))}
                    </Col>
                  </Fragment>
                ))}
              </TreeView>
            </>
          )}
        </Col>
      </Col>
    </Container>
  );
};
