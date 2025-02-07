import React from 'react';
import {
  OperatorState,
  L1Tx,
  L2Tx,
  Deposit,
  DepositBatch,
  WithdrawalBatch,
} from './state';

// ─── TOOLTIP COMPONENT ──────────────────────────────────────
const Tooltip: React.FC<
  React.PropsWithChildren<{ content: React.ReactNode }>
> = ({ content, children }) => {
  const [hover, setHover] = React.useState(false);

  return (
    <span
      style={{ position: 'relative', cursor: 'pointer' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {hover && (
        <div
          style={{
            position: 'absolute',
            bottom: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '8px',
            borderRadius: '4px',
            zIndex: 10,
            width: '250px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            fontSize: '0.85rem',
            whiteSpace: 'normal',
          }}
        >
          {content}
        </div>
      )}
    </span>
  );
};

// ─── TX TOOLTIP ─────────────────────────────────────────────
interface TxTooltipProps {
  tx: L1Tx | L2Tx;
}
const TxTooltip: React.FC<TxTooltipProps> = ({ tx }) => {
  const content = (
    <div>
      <div>
        <strong>Type:</strong> {tx.type}
      </div>
      <div>
        <strong>Hash:</strong> {tx.hash}
      </div>
      <div>
        <strong>Status:</strong> {tx.status}
      </div>
      {'blockNumber' in tx && (
        <div>
          <strong>Block:</strong> {tx.blockNumber}
        </div>
      )}
    </div>
  );
  return (
    <Tooltip content={content}>{tx.hash.substring(0, 10) + '...'}</Tooltip>
  );
};

// ─── PENDING DEPOSITS TABLE ──────────────────────────────────
interface PendingDepositsTableProps {
  deposits: Deposit[];
}
const PendingDepositsTable: React.FC<PendingDepositsTableProps> = ({
  deposits,
}) => {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '1rem',
      }}
    >
      <thead>
        <tr style={{ backgroundColor: '#eee' }}>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>Amount</th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>
            Recipient
          </th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>
            Origin Transaction
          </th>
        </tr>
      </thead>
      <tbody>
        {deposits.map((dep, index) => (
          <tr key={index}>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {dep.amount.toString()}
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {dep.recipient}
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              <TxTooltip tx={dep.origin} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── DEPOSIT BATCHES TABLE ───────────────────────────────────
interface DepositBatchesTableProps {
  batches: DepositBatch[];
}
const DepositBatchesTable: React.FC<DepositBatchesTableProps> = ({
  batches,
}) => {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '1rem',
      }}
    >
      <thead>
        <tr style={{ backgroundColor: '#eee' }}>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>#</th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>Status</th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>Deposits</th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>
            Aggregation Groups
          </th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>
            Finalize Tx
          </th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>
            Deposit Tx
          </th>
          <th style={{ border: '1px solid #ccc', padding: '4px' }}>
            Verify Tx
          </th>
        </tr>
      </thead>
      <tbody>
        {batches.map((batch, index) => (
          <tr key={index}>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {index}
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {batch.status}
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {batch.deposits.length}{' '}
              <Tooltip
                content={
                  <div>
                    {batch.deposits.map((dep, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>
                        <div>
                          <strong>Amount:</strong> {dep.amount.toString()}
                        </div>
                        <div>
                          <strong>Recipient:</strong> {dep.recipient}
                        </div>
                        <div>
                          <strong>Origin:</strong> <TxTooltip tx={dep.origin} />
                        </div>
                        {i < batch.deposits.length - 1 && (
                          <hr style={{ margin: '4px 0' }} />
                        )}
                      </div>
                    ))}
                  </div>
                }
              >
                <span style={{ textDecoration: 'underline', color: 'blue' }}>
                  Details
                </span>
              </Tooltip>
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {batch.aggregationTxs.length}{' '}
              <Tooltip
                content={
                  <div>
                    {batch.aggregationTxs.map((group, gIndex) => (
                      <div key={gIndex} style={{ marginBottom: '4px' }}>
                        <strong>Group {gIndex + 1}:</strong>
                        {group.map((tx, tIndex) => (
                          <div key={tIndex}>
                            <TxTooltip tx={tx} />
                          </div>
                        ))}
                        {gIndex < batch.aggregationTxs.length - 1 && (
                          <hr style={{ margin: '4px 0' }} />
                        )}
                      </div>
                    ))}
                  </div>
                }
              >
                <span style={{ textDecoration: 'underline', color: 'blue' }}>
                  View Groups
                </span>
              </Tooltip>
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {'finalizeBatchTx' in batch ? (
                <TxTooltip tx={batch.finalizeBatchTx} />
              ) : (
                'N/A'
              )}
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {'depositTx' in batch ? (
                <TxTooltip tx={batch.depositTx} />
              ) : (
                'N/A'
              )}
            </td>
            <td style={{ border: '1px solid #ccc', padding: '4px' }}>
              {'verifyTx' in batch ? <TxTooltip tx={batch.verifyTx} /> : 'N/A'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── WITHDRAWAL BATCHES TABLE ───────────────────────────────
interface WithdrawalBatchesTableProps {
  batches: WithdrawalBatch[];
}
const WithdrawalBatchesTable: React.FC<WithdrawalBatchesTableProps> = ({
  batches,
}) => {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '1rem',
      }}
    >
      <thead>
        <tr style={{ backgroundColor: '#eee' }}>
          <th style={{ border: '1px solid #f00', padding: '4px' }}>Status</th>
          <th style={{ border: '1px solid #f00', padding: '4px' }}>ID</th>
          <th style={{ border: '1px solid #f00', padding: '4px' }}>
            Withdrawals
          </th>
          <th style={{ border: '1px solid #f00', padding: '4px' }}>
            Close Withdrawal Tx
          </th>
          <th style={{ border: '1px solid #f00', padding: '4px' }}>
            Withdraw Batch Tx
          </th>
          <th style={{ border: '1px solid #f00', padding: '4px' }}>
            Expansion Groups
          </th>
          <th style={{ border: '1px solid #f00', padding: '4px' }}>
            Batch Hash
          </th>
        </tr>
      </thead>
      <tbody>
        {batches.map((batch, index) => (
          <tr key={index}>
            <td style={{ border: '1px solid #f00', padding: '4px' }}>
              {batch.status}
            </td>
            <td style={{ border: '1px solid #f00', padding: '4px' }}>
              {batch.id.toString()}
            </td>
            <td style={{ border: '1px solid #f00', padding: '4px' }}>
              {batch.withdrawals.length}{' '}
              <Tooltip
                content={
                  <div>
                    {batch.withdrawals.map((w, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>
                        <div>
                          <strong>Amount:</strong> {w.amount.toString()}
                        </div>
                        <div>
                          <strong>Recipient:</strong> {w.recipient}
                        </div>
                        <div>
                          <strong>Origin:</strong> {w.origin}
                        </div>
                        <div>
                          <strong>Block:</strong> {w.blockNumber}
                        </div>
                        {i < batch.withdrawals.length - 1 && (
                          <hr style={{ margin: '4px 0' }} />
                        )}
                      </div>
                    ))}
                  </div>
                }
              >
                <span style={{ textDecoration: 'underline', color: 'blue' }}>
                  Details
                </span>
              </Tooltip>
            </td>
            <td style={{ border: '1px solid #f00', padding: '4px' }}>
              {'closeWithdrawalBatchTx' in batch ? (
                <TxTooltip tx={batch.closeWithdrawalBatchTx} />
              ) : (
                'N/A'
              )}
            </td>
            <td style={{ border: '1px solid #f00', padding: '4px' }}>
              {'withdrawBatchTx' in batch ? (
                <TxTooltip tx={batch.withdrawBatchTx} />
              ) : (
                'N/A'
              )}
            </td>
            <td style={{ border: '1px solid #f00', padding: '4px' }}>
              {'expansionTxs' in batch ? (
                <Tooltip
                  content={
                    <div>
                      {batch.expansionTxs.map((group, gIndex) => (
                        <div key={gIndex} style={{ marginBottom: '4px' }}>
                          <strong>Group {gIndex + 1}:</strong>
                          {group.map((tx, tIndex) => (
                            <div key={tIndex}>
                              <TxTooltip tx={tx} />
                            </div>
                          ))}
                          {gIndex < batch.expansionTxs.length - 1 && (
                            <hr style={{ margin: '4px 0' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  }
                >
                  <span style={{ textDecoration: 'underline', color: 'blue' }}>
                    View Groups
                  </span>
                </Tooltip>
              ) : (
                'N/A'
              )}
            </td>
            <td style={{ border: '1px solid #f00', padding: '4px' }}>
              {'hash' in batch ? batch.hash : 'N/A'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── MAIN COMPONENT: OPERATOR STATE PAGE ───────────────────
interface OperatorStatePageProps {
  state: OperatorState;
}
const OperatorStatePage: React.FC<OperatorStatePageProps> = ({ state }) => {
  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Operator State</h1>

      <section>
        <h2>Block Numbers</h2>
        <p>
          <strong>L1 Block:</strong> {state.l1BlockNumber}
        </p>
        <p>
          <strong>L2 Block:</strong> {state.l2BlockNumber}
        </p>
      </section>

      <section>
        <h2>Total</h2>
        <p>{state.total.toString()}</p>
      </section>

      <section>
        <h2>Pending Deposits</h2>
        {state.pendingDeposits.length > 0 ? (
          <PendingDepositsTable deposits={state.pendingDeposits} />
        ) : (
          <p>No pending deposits</p>
        )}
      </section>

      <section>
        <h2>Deposit Batches</h2>
        {state.depositBatches.length > 0 ? (
          <DepositBatchesTable batches={state.depositBatches} />
        ) : (
          <p>No deposit batches</p>
        )}
      </section>

      <section>
        <h2>Withdrawal Batches</h2>
        {state.withdrawalBatches.length > 0 ? (
          <WithdrawalBatchesTable batches={state.withdrawalBatches} />
        ) : (
          <p>No withdrawal batches</p>
        )}
      </section>
    </div>
  );
};

export default OperatorStatePage;
