import {Col} from '../../components';
import {useOperatorState} from '../../hooks';
import {DepositCard} from './DepositCard';
import {NetworkError} from './NetworkError';
import {PendingTableRow} from './PendingTableRow';
import {StateHeader} from './StateHeader';
import {Container, HistoryContainer, HistorySectionContainer, SectionCard, SectionCardTitle, Table} from './styled';
import {WithdrawalCard} from './WithdrawalCard';

const Landing: React.FC = () => {
  const {data: state, isLoading, error} = useOperatorState();

  return (
    <Container $flex={1}>
      <Col $gap="large" $flex={1} className="container">
        {!isLoading && error && <NetworkError />}

        <StateHeader />

        <HistoryContainer>
          <SectionCard className="pending">
            <SectionCardTitle>Pending</SectionCardTitle>

            <Table headings={['RECIPIENT', 'AMOUNT', 'ORIGIN TRANSACTION']}>
              {state?.pendingDeposits?.map((deposit) => (
                <PendingTableRow key={deposit.origin.hash} deposit={deposit} />
              ))}
            </Table>
          </SectionCard>

          <SectionCard className="deposits">
            <SectionCardTitle>Deposits</SectionCardTitle>

            <HistorySectionContainer>
              {state?.depositBatches?.map((depositBatch, index) => (
                // depositBatch doesn't always have a unique identifier, so using the index as the key
                <DepositCard key={index.toString()} deposit={depositBatch} />
              ))}
            </HistorySectionContainer>
          </SectionCard>

          <SectionCard className="withdrawals">
            <SectionCardTitle>Withdrawals</SectionCardTitle>

            <HistorySectionContainer>
              {state?.withdrawalBatches?.map((withdrawalBatch) => (
                <WithdrawalCard key={withdrawalBatch.id.toString()} withdrawal={withdrawalBatch} />
              ))}
            </HistorySectionContainer>
          </SectionCard>
        </HistoryContainer>
      </Col>
    </Container>
  );
};

export default Landing;
