

import { BridgeMerkle, loadContractArtifacts, utils } from 'l1'
import { L2Address } from '../state'
import * as l1Api from './api'
import * as env from './env'



const main = async () => {

    loadContractArtifacts()

    const l2Address: L2Address = '0x01176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8' as L2Address
    const depositAmt = 699n
    const deposit = await l1Api.createDeposit(env.operatorSigner, l2Address, depositAmt)
    console.log('deposit', deposit)
}

main().catch(console.error)
