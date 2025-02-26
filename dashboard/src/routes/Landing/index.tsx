import {Col, LineChart, Row, Text} from '../../components';
import {ChartCard, Container, ContentCard} from './styled';

const Landing: React.FC = () => {
  return (
    <Container>
      <Col alignItems="center" gap="medium">
        <Text.HeadlineLarge>Pontis</Text.HeadlineLarge>
        <Text.HeadlineSmall>OP_CAT enabled Bitcoin &lt;-&gt; Starknet Bridge</Text.HeadlineSmall>
      </Col>

      <Col flex={1} gap="large">
        <Row gap="large">
          <ChartCard>
            <LineChart
              labels={['Mon', 'Tue', 'Wen', 'Thu', 'Fri', 'Sat', 'Sun']}
              datasets={[
                {
                  label: 'L1 -> L2',
                  data: [12, 19, 3, 5, 2, 3, 5],
                  borderColor: '#FF718B',
                },
                {
                  label: 'L2 -> L1',
                  data: [4, 9, 5, 3, 19, 2, 4],
                  borderColor: '#4A3AFF',
                },
              ]}
            />
          </ChartCard>
          <ContentCard />
          <ContentCard />
        </Row>

        <Row gap="large">
          <Col flex={1} gap="large">
            <ContentCard />
            <ContentCard />
          </Col>

          <Col flex={1} gap="large">
            <ContentCard />
          </Col>
        </Row>
      </Col>
    </Container>
  );
};

export default Landing;
