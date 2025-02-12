## Draft of what needs to be implemented in the Operator for L1

### Deposit Indexer:

Deposit Indexer should be a part of the operator, not more than a function scanning a given block for pending deposit transactions:

- `getPendingDeposits(blockId: number) -> Promise<Deposit[]>` - return new deposits created in a given block

### Deposit Creation

We should have a way to create deposit transactions for users. Tbd.

### Deposit Aggregation

Assuming that aggregation happens in rounds:

- `aggregateDeposits(txs: L1TxHash[]) -> Promise<L1TxHashAndStatus[]>` - create and send a round of aggregation txs based on previous round of aggregation. Actual parameter types should be defined during implementation.

### Register aggregated deposits in the Bridge State Contract

- `registerDepositBatch(depositBatchTx: L1TxHash, root: string) -> Promise<L1TxHashAndStatus>` - create and send a deposit batch registration transaction. Exact parameters tbd during implementation.

### Mark aggregated deposits as completed on L2 in the Bridge State Contract

- `completeDepositBatch(depositBatchTx: L1TxHash, root: string) -> Promise<L1TxHashAndStatus>` - given aggregated deposit batch create and send a deposit batch completion transaction

### Register aggregated withdrawals in the Bridge State Contract




- `registerWithdrawalBatch(withdrawalBatchId: number, root: string) -> Promise<L1TxHashAndStatus>` - create and send a withdrawal batch registration transaction

### Withdrawals expansion

Assuming that expansion happens in rounds:

- `expandWithdrawals(txs: L1TxHash) -> Promise<L1TxHashAndStatus[]>` - create and send a round of expansion txs based on previous round of expansion. Actual parameter types tbd during implementation.

### Withdrawal Creation

We should have a way to create withdrawal transactions for users. Tbd.

### Transaction monitoring

- `l1TransactionStatus(tx: L1TxHash) -> L1TxHashAndStatus` - return status of l1 transaction given its txid

### Transaction state transiontion function

Is should handle transaction state, handle necessary edge cases. Tbd.
