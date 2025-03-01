import cx from 'classnames';
import {Fragment} from 'react';

import {Col, Divider, ExplorerLink, Icon, Row, Table, Text} from '../../../components';
import {DepositBatch} from '../../../types';
import {shortenHex, showDepositStatus} from '../../../utils/format';
import {Container, SectionTitle, TransactionCard} from './styled';

type DepositCardProps = {
  deposit: DepositBatch;
};

export const DepositCard: React.FC<DepositCardProps> = ({deposit}) => {
  const batchId = 'batchId' in deposit ? deposit.batchId : undefined;
  const finalizeBatchTx = 'finalizeBatchTx' in deposit ? deposit.finalizeBatchTx : undefined;
  const depositTx = 'depositTx' in deposit ? deposit.depositTx : undefined;
  const verifyTx = 'verifyTx' in deposit ? deposit.verifyTx : undefined;

  const horizontalClassName = 'd-none d-md-flex d-lg-none d-xxl-flex';
  const verticalClassName = 'd-flex d-md-none d-lg-flex d-xxl-none';

  const renderedAggregationTxs = deposit.aggregationTxs.map((aggregationTxLevels, levelIdx) => (
    <Fragment key={levelIdx.toString()}>
      {levelIdx % 2 === 1 && (
        <>
          <Icon className={horizontalClassName} name="DoubleArrowRight" color="border" width={33} height={87} />
          <Icon className={cx(verticalClassName, 'align-self-center')} name="ArrowDown" color="border" width={32} />
        </>
      )}

      <Col $gap="xxsmall">
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
                  <ExplorerLink network="l1" address={aggregationTx.depositAddress}>
                    <Text.CardValue $color="inherit">{shortenHex(aggregationTx.depositAddress)}</Text.CardValue>
                  </ExplorerLink>
                </Row>
              </>
            )}

            <Row $gap="xlarge" $justify="space-between" $alignItems="center">
              <Text.CardTitle>TX Hash:</Text.CardTitle>
              <ExplorerLink tx={aggregationTx.tx}>
                <Text.CardValue $color="inherit">{shortenHex(aggregationTx.tx.hash)}</Text.CardValue>
              </ExplorerLink>
            </Row>
          </TransactionCard>
        ))}
      </Col>
    </Fragment>
  ));

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

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Deposits</SectionTitle>

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

      <SectionTitle>Aggregation Transactions</SectionTitle>

      <Col className="d-flex d-md-none d-lg-flex d-xxl-none">{renderedAggregationTxs}</Col>

      <Row $alignItems="center" className="d-none d-md-flex d-lg-none d-xxl-flex">
        {renderedAggregationTxs}
      </Row>
    </Container>
  );
};
