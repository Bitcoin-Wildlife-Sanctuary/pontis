'use client';

import {Fragment} from 'react';
import {useTheme} from 'styled-components';

import {Col, Icon, Row, Text} from '@/components';
import {useAutoUpdateState, useToggleTheme} from '@/hooks';
import {StateWithDate} from '@/types';

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
  ThemeButton,
} from './styled';
import {WithdrawalCard} from './WithdrawalCard';

export default function Page({initialState}: {initialState: StateWithDate}) {
  const {state, lastUpdate} = useAutoUpdateState(initialState);

  const theme = useTheme();
  const toggleTheme = useToggleTheme();

  return (
    <Container $flex={1}>
      <Col $gap="large" $flex={1} className="container">
        <Col $gap="xxsmall">
          <Row $alignItems="center" $justify="space-between">
            <Row $gap="small">
              <Text.BodyStrong>Last Update:</Text.BodyStrong>
              <Text.BodyStrong>{lastUpdate.toLocaleString()}</Text.BodyStrong>
            </Row>

            <ThemeButton onClick={toggleTheme}>
              <Icon name={theme.dark ? 'Sun' : 'Moon'} color="primary" size={24} />
            </ThemeButton>
          </Row>

          <StateHeader state={state} />
        </Col>

        <HistoryContainer>
          <SectionCard className="deposits">
            <SectionCardTitle $textAlign="center" $elevated>
              Deposits
            </SectionCardTitle>

            <HistorySectionContainer>
              {(state.pendingDeposits?.length ?? 0) > 0 && (
                <ContentCard $surface>
                  <SectionCardTitle as={Text.BodyStrong} $fontSize={22}>
                    Pending
                  </SectionCardTitle>

                  <Col $padding="small">
                    <Table headings={['Recipient', 'Amount', 'Origin Tx']}>
                      {state.pendingDeposits.map((deposit) => (
                        <Fragment key={deposit.origin.hash}>
                          <PendingTableRow deposit={deposit} />
                        </Fragment>
                      ))}
                    </Table>
                  </Col>
                </ContentCard>
              )}

              {state.depositBatches?.map((depositBatch, index) => (
                // depositBatch doesn't always have a unique identifier, so using the index as the key
                <DepositCard key={index.toString()} deposit={depositBatch} />
              ))}
            </HistorySectionContainer>
          </SectionCard>

          <SectionCard className="withdrawals">
            <SectionCardTitle $textAlign="center" $elevated>
              Withdrawals
            </SectionCardTitle>

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
