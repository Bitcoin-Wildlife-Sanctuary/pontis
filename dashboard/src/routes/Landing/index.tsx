import {Col} from '../../components';
import {useOperatorState} from '../../hooks';
import {DepositCard} from './DepositCard';
import {PendingTableRow} from './PendingTableRow';
import {StateHeader} from './StateHeader';
import {
  Container,
  HistoryContainer,
  HistorySectionContainer,
  ScrollableContainer,
  SectionCard,
  SectionCardTitle,
  Table,
} from './styled';
import {WithdrawalCard} from './WithdrawalCard';

const Landing: React.FC = () => {
  const {data: state, isLoading} = useOperatorState();

  return (
    <Container $flex={1}>
      <Col $gap="large" $flex={1} className="container">
        <StateHeader />

        <HistoryContainer>
          <SectionCard className="pending">
            <SectionCardTitle>Pending</SectionCardTitle>

            <ScrollableContainer>
              <Table headings={['RECIPIENT', 'AMOUNT', 'ORIGIN TRANSACTION']}>
                {state?.pendingDeposits?.map((deposit) => (
                  <PendingTableRow key={deposit.origin.hash} deposit={deposit} />
                ))}
              </Table>
            </ScrollableContainer>
          </SectionCard>

          <SectionCard className="deposits">
            <SectionCardTitle>Deposits</SectionCardTitle>

            <ScrollableContainer>
              <HistorySectionContainer>
                {state?.depositBatches?.map((depositBatch, index) => (
                  // depositBatch doesn't always have a unique identifier, so using the index as the key
                  <DepositCard key={index.toString()} deposit={depositBatch} />
                ))}
              </HistorySectionContainer>
            </ScrollableContainer>
          </SectionCard>

          <SectionCard className="withdrawals">
            <SectionCardTitle>Withdrawals</SectionCardTitle>

            <ScrollableContainer>
              <HistorySectionContainer>
                {state?.withdrawalBatches?.map((withdrawalBatch) => (
                  <WithdrawalCard key={withdrawalBatch.id.toString()} withdrawal={withdrawalBatch} />
                ))}
              </HistorySectionContainer>
            </ScrollableContainer>
          </SectionCard>
        </HistoryContainer>
      </Col>
    </Container>
  );
};

export default Landing;
