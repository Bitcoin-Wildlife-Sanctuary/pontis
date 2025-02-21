import express from 'express';
import * as ReactDOMServer from 'react-dom/server';
import { Observable } from 'rxjs';
import { asString, OperatorState } from './state';
import OperatorStateView from './OperatorStateView';

export function serve(state: Observable<OperatorState>) {
  const app = express();

  let latestState: OperatorState | undefined = undefined;

  app.get('/', (req, res) => {
    const content = !latestState
      ? 'State not ready yet'
      : ReactDOMServer.renderToString(
          <OperatorStateView state={latestState}/>
        );
    res.send(content);
  });  

  // Start the server on port 3000
  const PORT = 3000;
  const server = app.listen(PORT, () => {
    console.log(`Express server is listening on http://localhost:${PORT}`);
  });

  state.subscribe({
    next: (state) => {
      latestState = state;
    },
    error: (err) => {
      console.error('Error:', err);
    },
    complete: () => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    }
  });
}