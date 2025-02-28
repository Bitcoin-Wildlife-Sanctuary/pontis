import NiceCatImage from '../../assets/nice-cat.jpeg';
import {Col, GridCol, GridRow, Icon, Row, Text} from '../../components';
import {DepositCard} from './DepositCard';
import {
  Container,
  ContentCard,
  HistoryContainer,
  HistorySectionContainer,
  LogoImage,
  ScrollableContainer,
  SectionCard,
  SectionCardTitle,
  Table,
} from './styled';
import {WithdrawalCard} from './WithdrawalCard';

const Landing: React.FC = () => {
  return (
    <Container $flex={1}>
      <Col $gap="large" $flex={1} className="container">
        <GridRow className="g-small">
          <GridCol flex span={2}>
            <ContentCard>
              <LogoImage src={NiceCatImage} alt="Nice Cat" />
            </ContentCard>
          </GridCol>

          <GridCol flex span={2}>
            <Col $gap="small" $flex={1}>
              <ContentCard $withPadding $flex="1 1 max-content">
                <Col $flex={1} $justify="center">
                  <Row $gap="xsmall">
                    <Text.Subtitle>Total:</Text.Subtitle>
                    <Text.Subtitle $color="textStrong">.....</Text.Subtitle>
                  </Row>
                </Col>
              </ContentCard>

              <ContentCard $withPadding $justify="center" $flex="1 1 max-content">
                <Col $flex={1} $justify="center" $gap="small">
                  <Row $gap="xsmall">
                    <Text.Subtitle>L1 Block:</Text.Subtitle>
                    <Text.Subtitle $color="textStrong">406906</Text.Subtitle>
                  </Row>

                  <Row $gap="xsmall">
                    <Text.Subtitle>L2 Block:</Text.Subtitle>
                    <Text.Subtitle $color="textStrong">0</Text.Subtitle>
                  </Row>
                </Col>
              </ContentCard>
            </Col>
          </GridCol>

          <GridCol flex span={3}>
            <ContentCard $withPadding $flex={1}>
              <Col $flex={1} $justify="center" $gap="small">
                <Row $gap="xsmall">
                  <Text.Subtitle>Latest TX:</Text.Subtitle>
                  <Text.Subtitle $color="textStrong">ab5a7...c5d91</Text.Subtitle>
                </Row>

                <Row $gap="xsmall">
                  <Text.Subtitle>Batches Root:</Text.Subtitle>
                  <Text.Subtitle $color="textStrong">1b02a...d9d1d</Text.Subtitle>
                </Row>

                <Row $gap="xsmall">
                  <Text.Subtitle>Deposit SPK:</Text.Subtitle>
                  <Text.Subtitle $color="textStrong">51204...3451</Text.Subtitle>
                </Row>
              </Col>
            </ContentCard>
          </GridCol>

          <GridCol flex span={5}>
            <Col $gap="small" $flex={1}>
              <ContentCard $withPadding $flex={1} $justify="center">
                <Text.Subtitle>Merkle Tree</Text.Subtitle>
              </ContentCard>

              <Col $flex={1} />
            </Col>
          </GridCol>
        </GridRow>

        <HistoryContainer>
          <SectionCard className="pending">
            <SectionCardTitle>Pending</SectionCardTitle>

            <ScrollableContainer>
              <Table headings={['RECIPIENT', 'AMOUNT', 'ORIGIN TRANSACTION']}>
                {Array.from({length: 20}).map((_, index) => (
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
              </Table>
            </ScrollableContainer>
          </SectionCard>

          <SectionCard className="deposits">
            <SectionCardTitle>Deposits</SectionCardTitle>

            <ScrollableContainer>
              <HistorySectionContainer>
                {Array.from({length: 2}).map((_, index) => (
                  <DepositCard key={index.toString()} />
                ))}
              </HistorySectionContainer>
            </ScrollableContainer>
          </SectionCard>

          <SectionCard className="withdrawals">
            <SectionCardTitle>Withdrawals</SectionCardTitle>

            <ScrollableContainer>
              <HistorySectionContainer>
                {Array.from({length: 2}).map((_, index) => (
                  <WithdrawalCard key={index.toString()} />
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
