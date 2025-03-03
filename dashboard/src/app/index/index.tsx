'use client';

import {Fragment} from 'react';

import {Col} from '@/components';
import {useAutoUpdateState} from '@/hooks';
import {OperatorState} from '@/types';

import {DepositCard} from './DepositCard';
import {PendingTableRow} from './PendingTableRow';
import {StateHeader} from './StateHeader';
import {
  Container,
  ContentCard,
  HistoryContainer,
  HistorySectionContainer,
  SectionCard,
  SectionCardTitle,
  Table,
} from './styled';
import {WithdrawalCard} from './WithdrawalCard';

export default function Page({initialState}: {initialState: OperatorState}) {
  const state = useAutoUpdateState(initialState);

  return (
    <Container $flex={1}>
      <Col $gap="large" $flex={1} className="container">
        <StateHeader state={state} />

        <HistoryContainer>
          <SectionCard className="deposits">
            <SectionCardTitle>Deposits</SectionCardTitle>

            <HistorySectionContainer>
              <ContentCard $surface>
                <SectionCardTitle>Pending</SectionCardTitle>

                <Table headings={['Recipient', 'Amount', 'Origin TX']}>
                  {state.pendingDeposits?.map((deposit) => (
                    <Fragment key={deposit.origin.hash}>
                      <PendingTableRow deposit={deposit} />
                    </Fragment>
                  ))}
                </Table>
              </ContentCard>

              {state.depositBatches?.map((depositBatch, index) => (
                // depositBatch doesn't always have a unique identifier, so using the index as the key
                <DepositCard key={index.toString()} deposit={depositBatch} />
              ))}
            </HistorySectionContainer>
          </SectionCard>

          <SectionCard className="withdrawals">
            <SectionCardTitle>Withdrawals</SectionCardTitle>

            <HistorySectionContainer>
              {state.withdrawalBatches?.map((withdrawalBatch) => (
                <WithdrawalCard key={withdrawalBatch.id.toString()} withdrawal={withdrawalBatch} />
              ))}
            </HistorySectionContainer>
          </SectionCard>
        </HistoryContainer>
      </Col>
    </Container>
  );
}
