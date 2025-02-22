import * as api from '../l1/api'
import * as env from '../l1/env'
import { PubKey } from 'scrypt-ts'
import { loadContractArtifacts } from '../l1/utils/contractUtil'

loadContractArtifacts()

const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = 8080

app.use(bodyParser.json())
app.get('/', (_req: any, res: any) => {
  res.sendFile('./index.html', { root: __dirname })
})

app.get('/bundle.js',  (_req: any, res: any) => {
  res.sendFile('./bundle.js', { root: __dirname })
})

app.post('/api/deposit', async (req: any, res: any) => {
  const { l1Address, l2Address, depositAmount } = req.body

  const operatorPubKey = await env.operatorSigner.getPublicKey()

  const deposit = await api.createDepositWithoutSigning(
    PubKey(operatorPubKey),

    env.l1Network,
    env.createUtxoProvider(),

    env.l1FeeRate,

    l1Address,
    l2Address,
    BigInt(depositAmount)
  )
  res.send({psbt: deposit.psbt, deposit: deposit.deposit, psbtOptions: deposit.psbtOptions})
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})