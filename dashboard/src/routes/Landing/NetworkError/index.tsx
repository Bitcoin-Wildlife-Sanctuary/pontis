import {Icon, Row, Text} from '../../../components';
import {Container} from './styled';

export const NetworkError: React.FC = () => {
  return (
    <Container>
      <Row $alignItems="center" $gap="small">
        <Icon name="AlertTriangle" size={20} color="textStrong" fontSize={24} />

        <Text.BodyStrong>
          A Network error occured while fetching the operator state. Please try again later.
        </Text.BodyStrong>
      </Row>
    </Container>
  );
};
