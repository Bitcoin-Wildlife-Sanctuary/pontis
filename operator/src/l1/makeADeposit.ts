

import { BridgeMerkle, loadContractArtifacts, utils } from 'l1'
import { L2Address } from '../state'
import * as l1Api from './api'
import * as env from './env'
import { getFileOffChainDataProvider } from './deps/offchainDataProvider'



const main = async () => {

    loadContractArtifacts()

    // const l2Address: L2Address = '0x00c55d3b840a60c09989377c9b4cfa6c428ef37ee7bbd47e93b0c0fa440a5be8'
    const l2Address: L2Address = '0x02d889448e2ce40fa6874e0bc0bd6156d535a1c9866fd9163be5756e5695493b'
    // const l2Address: L2Address = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
    // const l2Address: L2Address = '0x01176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8' as L2Address
    const depositAmt = 509n
    const deposit = await l1Api.createDeposit(
        env.operatorSigner,
        env.l1Network,
        env.createUtxoProvider(),
        env.createChainProvider(),
        getFileOffChainDataProvider(),

        env.l1FeeRate,

        env.operatorSigner,
        l2Address,
        depositAmt,
    )
    console.log('deposit', deposit)
}

main().catch(console.error)
