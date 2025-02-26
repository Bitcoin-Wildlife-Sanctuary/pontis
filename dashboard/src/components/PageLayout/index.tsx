import {Outlet} from 'react-router-dom';

export const PageLayout: React.FC = () => {
  return (
    <div className="container">
      <Outlet />
    </div>
  );
};
