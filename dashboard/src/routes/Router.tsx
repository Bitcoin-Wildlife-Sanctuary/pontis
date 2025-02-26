import {Navigate, Route, Routes} from 'react-router-dom';

import {PageLayout} from '../components';
import Landing from './Landing';

const Router: React.FC = () => (
  <Routes>
    <Route path="/" element={<PageLayout />}>
      <Route path="/" element={<Landing />} />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default Router;
