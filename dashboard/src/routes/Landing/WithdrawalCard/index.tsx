import {Col, Divider, Icon, Row, Table, Text} from '../../../components';
import {Container, SectionTitle} from './styled';

export const WithdrawalCard: React.FC = () => {
  return (
    <Container>
      <Row $gap="xxlarge">
        <Col $gap="xxsmall" $justify="center">
          <Text.CardTitle>Status:</Text.CardTitle>
          <Text.CardTitle>ID:</Text.CardTitle>
          <Text.CardTitle>Hash:</Text.CardTitle>
          <Text.CardTitle>Close TX:</Text.CardTitle>
        </Col>

        <Col $gap="xxsmall" $justify="center">
          <Text.CardValue>Closed</Text.CardValue>
          <Text.CardValue>0</Text.CardValue>
          <Text.CardValue>0xf9f259cc10...f0005eb18</Text.CardValue>

          <Row $gap="small">
            <Text.CardValue>Succeeded</Text.CardValue>
            <Text.CardValue>0x8f80f1eb350...9ce925af1</Text.CardValue>
          </Row>
        </Col>
      </Row>

      <Divider $marginTop="xxsmall" $marginBottom="xxsmall" />

      <SectionTitle>Withdrawals</SectionTitle>

      <Table headings={['Recipient', 'Amount', 'Origin TX']}>
        {Array.from({length: 3}).map((_, index) => (
          <tr key={index.toString()}>
            <td>
              <a href="#">
                <Row $alignItems="center" $gap="xsmall">
                  <Text.BodyStrong $color="inherit">03bfac...5b398a8</Text.BodyStrong>

                  <Icon name="ExternalLink" color="inherit" size={18} />
                </Row>
              </a>
            </td>

            <td>
              <Text.BodyStrong title="0.00000000000000001">1e-17</Text.BodyStrong>
            </td>

            <td>
              <a href="#">
                <Row $alignItems="center" $gap="xsmall">
                  <Text.BodyStrong $color="inherit">0x388c2...b1f1687</Text.BodyStrong>

                  <Icon name="ExternalLink" color="inherit" size={18} />
                </Row>
              </a>
            </td>
          </tr>
        ))}
      </Table>
    </Container>
  );
};
