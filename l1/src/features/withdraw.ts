import { ChainProvider } from "src/lib/provider";
import { UtxoProvider } from "src/lib/provider";
import { Withdrawal } from "../util/merkleUtils";
import { Signer } from "src/lib/signer";


export function expandWithdrawal(
    signer: Signer,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,

    expanderUtxo: TraceableWithdrawalExpanderUtxo,
) {

}

function buildExpandWithdrawalTx(withdrawal: Withdrawal) {

}

