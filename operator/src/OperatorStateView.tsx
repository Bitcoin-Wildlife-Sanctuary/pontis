import React from 'react';
import { OperatorState } from './state';

interface TwoColumnLayoutProps {
  /**
   * Text to display in the left column inside a <pre> tag.
   */
  leftColumnPreText?: string;
}

/** 
 * Inline style objects (for demo).
 * 
 * In a larger project, prefer CSS or CSS-in-JS solutions.
 */
const headerStyle: React.CSSProperties = {
  backgroundColor: '#ddd',
  padding: '20px',
};

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
};

const columnStyle: React.CSSProperties = {
  flex: 1,
  padding: '20px',
  boxSizing: 'border-box',
};

const leftColumnStyle: React.CSSProperties = {
  backgroundColor: '#f0f0f0',
};

const rightColumnStyle: React.CSSProperties = {
  backgroundColor: '#fff',
};

export default function ({ state }: { state: OperatorState}) {

  const {pendingDeposits, depositBatches, withdrawalBatches, ...header} = state;

  return (
    <html>
      <head>
        <meta http-equiv="refresh" content="5"/>
        <title>Operator State</title>
      </head>
      <body>
      
      <header style={headerStyle}>
        <h1>Bridge</h1>
        <pre>{JSON.stringify(header, null, 2)}</pre>
      </header>

      <div style={containerStyle}>
        <div style={{ ...columnStyle, ...leftColumnStyle }}>
          <h2>Pending Deposits</h2>
          <pre>{JSON.stringify(pendingDeposits, null, 2)}</pre>
          <h2>Batches</h2>
          <pre>{JSON.stringify(depositBatches, null, 2)}</pre>
        </div>

        <div style={{ ...columnStyle, ...rightColumnStyle }}>
          <h2>Withdrawals</h2>
          <pre>{JSON.stringify(withdrawalBatches, null, 2)}</pre>
        </div>
      </div>
      </body>
    </html>
  );
};
