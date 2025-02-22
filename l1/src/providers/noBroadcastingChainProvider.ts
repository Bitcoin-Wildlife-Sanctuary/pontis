import { ChainProvider } from "../lib/provider";
import { Transaction } from "@scrypt-inc/bitcoinjs-lib";

export class NoBroadcastingChainProvider implements ChainProvider {
    constructor(private readonly baseProvider: ChainProvider) {}
    async getRawTransaction(txId: string): Promise<string> {
        return this.baseProvider.getRawTransaction(txId)
    }
    async getConfirmations(txId: string): Promise<number> {
        return this.baseProvider.getConfirmations(txId)
    }
    async broadcast(txHex: string): Promise<string> {
        const txId = Transaction.fromHex(txHex).getId()
        return txId
    }
}
