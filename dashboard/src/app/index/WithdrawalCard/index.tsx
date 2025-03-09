import {useMemo} from 'react';

import {Col, Divider, ExplorerLink, Row, StatusChip, Table, Text, TreeView} from '@/components';
import {WithdrawalBatch} from '@/types';
import {shortenHex} from '@/utils/format';
import {fillExpansionTxs} from '@/utils/json';

import {Container, SectionTitle, SectionTitleContainer, TransactionCard} from './styled';

type WithdrawalCardProps = {
  withdrawal: WithdrawalBatch;
};

export const WithdrawalCard: React.FC<WithdrawalCardProps> = ({withdrawal}) => {
  const hash = 'hash' in withdrawal ? withdrawal.hash : undefined;
  const closeTx = 'closeWithdrawalBatchTx' in withdrawal ? withdrawal.closeWithdrawalBatchTx : undefined;
  const createExpanderTx = 'createExpanderTx' in withdrawal ? withdrawal.createExpanderTx : undefined;
  const rawExpansionTree = 'expansionTree' in withdrawal ? withdrawal.expansionTree : undefined;
  const rawExpansionTxs = 'expansionTxs' in withdrawal ? withdrawal.expansionTxs : undefined;

  const expansionTxs = useMemo(() => {
    if (!rawExpansionTxs || !rawExpansionTree) return undefined;

    return fillExpansionTxs(rawExpansionTree, rawExpansionTxs);
  }, [rawExpansionTxs, rawExpansionTree]);

  return (
    <Container>
      <SectionTitleContainer as={Row} $justify="space-between" $alignItems="center" $gap="none">
        <Col $gap="xxsmall">
          <Row $gap="xxsmall">
            <SectionTitle>Batch:</SectionTitle>
            <SectionTitle>{withdrawal.id.toString()}</SectionTitle>
          </Row>

          {hash && (
            <Row $gap="xxsmall">
              <SectionTitle>Hash:</SectionTitle>
              <SectionTitle>{shortenHex(hash, 10)}</SectionTitle>
            </Row>
          )}
        </Col>

        <StatusChip type="withdrawal" status={withdrawal.status} />
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
        <Col $gap="xsmall">
          <Row $gap="xxlarge">
            <Col $gap="xxsmall" $justify="center">
              {closeTx && <Text.CardTitle>Close Tx:</Text.CardTitle>}
              {createExpanderTx && <Text.CardTitle>Create Expander Tx:</Text.CardTitle>}
            </Col>

            <Col $gap="xxsmall" $justify="center">
              {closeTx && (
                <ExplorerLink tx={closeTx}>
                  <Text.CardValue $color="inherit">{shortenHex(closeTx.hash)}</Text.CardValue>
                </ExplorerLink>
              )}

              {createExpanderTx && (
                <ExplorerLink tx={createExpanderTx}>
                  <Text.CardValue $color="inherit">{shortenHex(createExpanderTx.hash)}</Text.CardValue>
                </ExplorerLink>
              )}
            </Col>
          </Row>

          {expansionTxs && expansionTxs.length > 0 && (
            <>
              <Text.CardTitle>Expansion Txs:</Text.CardTitle>

              <TreeView
                items={expansionTxs}
                keyExtractor={(expansionTx, index) => `${expansionTx.hash}-${index}`}
                renderItem={(expansionTx) => (
                  <TransactionCard $gap={4}>
                    <Row $justify="space-between" $alignItems="center" $gap="xsmall">
                      <Col>
                        <Text.CardValue>{expansionTx.total?.toString()}</Text.CardValue>
                      </Col>

                      <Col $alignItems="flex-end">
                        {expansionTx.nodeType === 'LEAF' && (
                          <ExplorerLink network="l1" address={expansionTx.address}>
                            <Text.CardValue $color="inherit">{shortenHex(expansionTx.address)}</Text.CardValue>
                          </ExplorerLink>
                        )}

                        <ExplorerLink tx={expansionTx}>
                          <Text.CardValue $color="inherit">{shortenHex(expansionTx.hash)}</Text.CardValue>
                        </ExplorerLink>
                      </Col>
                    </Row>
                  </TransactionCard>
                )}
              />
            </>
          )}
        </Col>
      </Col>
    </Container>
  );
};
