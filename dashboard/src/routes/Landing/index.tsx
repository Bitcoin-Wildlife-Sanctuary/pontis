import {Col, Row, Text} from '../../components';
import {Container, ContentCard} from './styled';

const Landing: React.FC = () => {
  return (
    <Container>
      <Col alignItems="center" gap="medium">
        <Text.HeadlineLarge>Pontis</Text.HeadlineLarge>
        <Text.HeadlineSmall>OP_CAT enabled Bitcoin &lt;-&gt; Starknet Bridge</Text.HeadlineSmall>
      </Col>

      <Col flex={1} gap="large">
        <Row gap="large">
          <ContentCard />
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
