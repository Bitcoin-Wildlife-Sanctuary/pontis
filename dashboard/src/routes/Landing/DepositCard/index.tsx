import {Col, Divider, Icon, Row, Text} from '../../../components';
import {Container, DepositsTable, SectionTitle, TransactionCard} from './styled';

export const DepositCard: React.FC = () => {
  return (
    <Container>
      <Row $gap="xxlarge">
        <Col $gap="xxsmall" $justify="center">
          <Text.CardTitle>Status:</Text.CardTitle>
          <Text.CardTitle>Batch ID:</Text.CardTitle>
          <Text.CardTitle>Finalize Batch TX:</Text.CardTitle>
          <Text.CardTitle>Deposit TX:</Text.CardTitle>
          <Text.CardTitle>Verify TX:</Text.CardTitle>
        </Col>

        <Col $gap="xxsmall" $justify="center">
          <Text.CardValue>Completed</Text.CardValue>
          <Text.CardValue>35749c91c...f53b564b055</Text.CardValue>

          <Row $gap="small">
            <Text.CardValue>Mined</Text.CardValue>
            <Text.CardValue>35749c91c...f53b564b055</Text.CardValue>
          </Row>

          <Row $gap="small">
            <Text.CardValue>Succeeded</Text.CardValue>
            <Text.CardValue>0x35749c91c...f53b564b055</Text.CardValue>
          </Row>

          <Row $gap="small">
            <Text.CardValue>Mined</Text.CardValue>
            <Text.CardValue>35749c91c...f53b564b055</Text.CardValue>
          </Row>
        </Col>
      </Row>

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Deposits</SectionTitle>

      <DepositsTable>
        <thead>
          <tr>
            <th>
              <Text.CardTitle $fontWeight={600}>Recipient</Text.CardTitle>
            </th>
            <th>
              <Text.CardTitle $fontWeight={600}>Amount</Text.CardTitle>
            </th>
            <th>
              <Text.CardTitle $fontWeight={600}>Origin TX</Text.CardTitle>
            </th>
          </tr>
        </thead>

        <tbody>
          {Array.from({length: 3}).map((_, index) => (
            <tr key={index.toString()}>
              <td>
                <a href="#">
                  <Row $alignItems="center" $gap="xsmall">
                    <Text.BodyStrong $color="inherit">0x02d8...493b</Text.BodyStrong>

                    <Icon name="ExternalLink" color="inherit" size={18} />
                  </Row>
                </a>
              </td>

              <td>
                <Text.BodyStrong>0.509</Text.BodyStrong>
              </td>

              <td>
                <a href="#">
                  <Row $alignItems="center" $gap="xsmall">
                    <Text.BodyStrong $color="inherit">1a6d...a0dd</Text.BodyStrong>

                    <Icon name="ExternalLink" color="inherit" size={18} />
                  </Row>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </DepositsTable>

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Aggregation Transactions</SectionTitle>

      <Row $alignItems="center">
        <Col $gap="xxsmall">
          <TransactionCard $gap={4}>
            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>Amount:</Text.CardTitle>
              <Text.CardValue>509</Text.CardValue>
            </Row>

            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>Address:</Text.CardTitle>
              <Text.CardValue>02d889...5493b</Text.CardValue>
            </Row>

            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>Status:</Text.CardTitle>
              <Text.CardValue>Mined</Text.CardValue>
            </Row>

            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>TX Hash:</Text.CardTitle>
              <Text.CardValue>955901...de66e</Text.CardValue>
            </Row>
          </TransactionCard>

          <TransactionCard $gap={4}>
            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>Amount:</Text.CardTitle>
              <Text.CardValue>509</Text.CardValue>
            </Row>

            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>Address:</Text.CardTitle>
              <Text.CardValue>02d889...5493b</Text.CardValue>
            </Row>

            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>Status:</Text.CardTitle>
              <Text.CardValue>Mined</Text.CardValue>
            </Row>

            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>TX Hash:</Text.CardTitle>
              <Text.CardValue>955901...de66e</Text.CardValue>
            </Row>
          </TransactionCard>
        </Col>

        <Icon name="DoubleArrowRight" color="border" width={33} height={87} />

        <Col>
          <TransactionCard $gap={4}>
            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>Status:</Text.CardTitle>
              <Text.CardValue>Mined</Text.CardValue>
            </Row>

            <Row $gap="xlarge" $justify="space-between">
              <Text.CardTitle>TX Hash:</Text.CardTitle>
              <Text.CardValue>955901...de66e</Text.CardValue>
            </Row>
          </TransactionCard>
        </Col>
      </Row>
    </Container>
  );
};
