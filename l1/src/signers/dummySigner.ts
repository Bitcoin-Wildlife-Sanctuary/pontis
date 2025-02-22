import { PSBTOptions, Signer } from "../lib/signer";


export class DummySigner implements Signer {

    private sigReqs: { psbtHex: string, options?: PSBTOptions }[] = [];
    static DUMMY_SIG = '70736274ff0100bc0200000001d9036d9f708cb10e483bf3cd76aa614e1e9e6d9ea547d307639ca7a32e5778ee0000000000ffffffff0300000000000000002a6a2802d889448e2ce40fa6874e0bc0bd6156d535a1c9866fd9163be5756e5695493b9b020000000000009b0200000000000022512040a1a612f896c0a9bab8908f7437bad67ca3e3e6c0fc53fa547325973f3534510717676ffebe0000225120e157c92fbb3072bb22122656ec90f98206a24691f57a8af4a626a51b39c4aec4000000000001012b0020676ffebe0000225120e157c92fbb3072bb22122656ec90f98206a24691f57a8af4a626a51b39c4aec4011340ee5230d6b72af262e677c1fe9c483705607e043ce29dc69f64f4a0b7385ceedb337c976be2cdf4641268f9e08e8a1d44cffc7f6eca67b9c3f241a293093e2562011720bfac5406925f9fa00194aa5fd093f60775d90475dcf88c24359eddd385b398a800000000'

    constructor(private readonly address: string) {
    }

    async getAddress(): Promise<string> {
        return this.address
    }

    async getPublicKey(): Promise<string> {
        // 03bfac5406925f9fa00194aa5fd093f60775d90475dcf88c24359eddd385b398a8
        return 'dummy'
    }

    async signPsbt(psbtHex: string, options?: PSBTOptions): Promise<string> {
        this.sigReqs.push({ psbtHex, options })
        return DummySigner.DUMMY_SIG
    }

    async signPsbts(reqs: { psbtHex: string, options?: PSBTOptions }[]): Promise<string[]> {
        this.sigReqs.push(...reqs)
        return reqs.map(_ => DummySigner.DUMMY_SIG)
    }

    popSigReqs(): { psbtHex: string, options?: PSBTOptions }[] {
        const reqs = this.sigReqs
        this.sigReqs = []
        return reqs
    }
}

