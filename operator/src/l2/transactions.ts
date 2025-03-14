import { RpcProvider, SuccessfulTransactionReceiptResponse } from 'starknet';
import { L2TxId, L2TxStatus } from '../state';
import {
  distinctUntilKeyChanged,
  from,
  mergeMap,
  Observable,
  takeWhile,
  timer,
} from 'rxjs';
import logger from '../logger';

async function getL2TransactionStatus(
  provider: RpcProvider,
  tx: L2TxId
): Promise<L2TxStatus> {
  const receipt = await provider.waitForTransaction(tx.hash);

  if (receipt.isSuccess()) {
    if ((receipt as any).block_number === undefined) {
      logger.warn({ hash: tx.hash }, `transaction is still pending... `);
      return {
        ...tx,
        status: 'PENDING',
      };
    } else {
      return {
        ...tx,
        blockNumber: (receipt as any).block_number,
        status: 'SUCCEEDED',
      };
    }
  }
  if (receipt.isReverted()) {
    return {
      ...tx,
      status: 'REVERTED',
    };
  } else if (receipt.isRejected()) {
    return {
      ...tx,
      status: 'REJECTED',
    };
  } else {
    logger.warn(
      { receipt },
      `Transaction ${tx.hash} failed with unknown status... `
    );
    return {
      ...tx,
      status: 'ERROR',
    };
  }
}

export function l2TransactionStatus(
  provider: RpcProvider,
  tx: L2TxId
): Observable<L2TxStatus> {
  return timer(0, 5000).pipe(
    mergeMap(() => from(getL2TransactionStatus(provider, tx)), 1),
    distinctUntilKeyChanged('status'),
    takeWhile((tx) => tx.status === 'PENDING', true)
  );
}
