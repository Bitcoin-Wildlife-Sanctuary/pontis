import express from 'express';
import * as ReactDOMServer from 'react-dom/server';
import { Observable } from 'rxjs';
import { OperatorState } from './state';
import OperatorStatePage from './OperatorState';

export function serve(state: Observable<OperatorState>) {
  const app = express();

  const initialState: OperatorState = {
    l1BlockNumber: 0,
    l2BlockNumber: 0,
    total: 0n,
    depositBatches: [],
    withdrawalBatches: [],
    pendingDeposits: [],
  };

  let latestState: OperatorState | undefined = undefined;
  state.subscribe({
    next: (state) => {
      latestState = state;
    },
  });

  app.get('/', (req, res) => {
    const content = !latestState
      ? 'State not ready yet'
      : ReactDOMServer.renderToString(
          <OperatorStatePage state={latestState} />
        );

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="5">
          <title>Operator State</title>
          <style>
            body { margin: 0; padding: 1rem; font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>
          <div id="root">${content}</div>
        </body>
      </html>
    `;
    res.send(html);
  });

  // Start the server on port 3000
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`Express server is listening on http://localhost:${PORT}`);
  });
}
