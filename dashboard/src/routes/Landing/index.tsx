import {Col, Divider, Icon, LineChart, Row, Text} from '../../components';
import {ChartCard, Container, ContentCard, ContentCardTitle, GridCard, GridCardItem, Table} from './styled';

const Landing: React.FC = () => {
  return (
    <Container>
      <Col $alignItems="center" $gap="medium">
        <Text.HeadlineLarge as="h1">Pontis</Text.HeadlineLarge>
        <Text.HeadlineSmall as="h2">OP_CAT enabled Bitcoin &lt;-&gt; Starknet Bridge</Text.HeadlineSmall>
      </Col>

      <Col $flex={1} $gap="large">
        <Row $gap="large">
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

          <GridCard>
            <GridCardItem>
              <Text.Subtitle $textAlign="center">L1 Block Number</Text.Subtitle>
              <Text.Title>406906</Text.Title>
            </GridCardItem>

            <GridCardItem>
              <Text.Subtitle $textAlign="center">L2 Block Number</Text.Subtitle>
              <Text.Title>0</Text.Title>
            </GridCardItem>

            <GridCardItem>
              <Text.Subtitle $textAlign="center">Latest TX Status</Text.Subtitle>
              <Text.Title>Unconfirmed</Text.Title>
            </GridCardItem>

            <GridCardItem>
              <Text.Subtitle $textAlign="center">Latest TX Hash</Text.Subtitle>
              <Text.Title>ab5a7...c5d91</Text.Title>
            </GridCardItem>
          </GridCard>

          <GridCard>
            <GridCardItem>
              <Text.Subtitle $textAlign="center">Batches Root</Text.Subtitle>
              <Text.Title>1b02a...d9d1d</Text.Title>
            </GridCardItem>

            <GridCardItem>
              <Text.Subtitle $textAlign="center">Deposit Aggregator SPK</Text.Subtitle>
              <Text.Title>51204...3451</Text.Title>
            </GridCardItem>

            <GridCardItem>
              <Text.Subtitle $textAlign="center">Merkle Tree</Text.Subtitle>
              <Text.Title $fontSize={16}>a293f678caf512f9...06fd6f415d090a30</Text.Title>
              <Text.Title $fontSize={16}>f6a7fbf50bd65442...42d59774478acfcb</Text.Title>
            </GridCardItem>
          </GridCard>
        </Row>

        <Row $gap="large">
          <Col $flex={1} $gap="large">
            <ContentCard>
              <ContentCardTitle>Pending</ContentCardTitle>
              <Divider $marginBottom="small" />

              <Table>
                <thead>
                  <tr>
                    <th>
                      <Text.Subtitle $fontWeight={600}>RECIPIENT</Text.Subtitle>
                    </th>
                    <th>
                      <Text.Subtitle $fontWeight={600}>AMOUNT</Text.Subtitle>
                    </th>
                    <th>
                      <Text.Subtitle $fontWeight={600}>ORIGIN TRANSACTION</Text.Subtitle>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {Array.from({length: 5}).map((_, index) => (
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
              </Table>
            </ContentCard>
            <ContentCard />
          </Col>

          <Col $flex={1} $gap="large">
            <ContentCard />
          </Col>
        </Row>
      </Col>
    </Container>
  );
};

export default Landing;
