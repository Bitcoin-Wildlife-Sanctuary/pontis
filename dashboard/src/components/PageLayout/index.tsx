import {Outlet} from 'react-router-dom';

import {Container} from './styled';

export const PageLayout: React.FC = () => {
  return (
    <Container className="container">
      <Outlet />
    </Container>
  );
};
