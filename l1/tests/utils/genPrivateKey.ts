import * as ecc from '@bitcoinerlab/secp256k1'
import ECPairFactory from 'ecpair'
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'
import { DefaultSigner } from '../../src/signers'

const ECPair = ECPairFactory(ecc)
bitcoinjs.initEccLib(ecc)

async function main() {
  const key = ECPair.makeRandom()

  const signer = new DefaultSigner(key)
  const address = await signer.getAddress()

  console.log('private key:', key.toWIF())
  console.log('address:', address)
}

main()
