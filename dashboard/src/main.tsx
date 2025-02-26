import '@csstools/normalize.css';

import ReactDOM from 'react-dom/client';

import {App} from './app/App';
import {Wrapper} from './app/Wrapper';

const Root: React.FC = () => {
  return (
    <Wrapper>
      <App />
    </Wrapper>
  );
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(<Root />);
