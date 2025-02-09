import * as ecc from '@bitcoinerlab/secp256k1'
import ECPairFactory from 'ecpair'
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'
import { DefaultSigner } from '../../src/signers'

const ECPair = ECPairFactory(ecc)
bitcoinjs.initEccLib(ecc)

async function main() {
  const key = ECPair.makeRandom()

  let btcSignetAddress = ''
  let fractalMainnetAddress = ''
  let fractalTestnetAddress = ''

  {
    const signer = new DefaultSigner(key, 'btc-signet')
    btcSignetAddress = await signer.getAddress()
  }

  {
    const signer = new DefaultSigner(key, 'fractal-mainnet')
    fractalMainnetAddress = await signer.getAddress()
  }

  {
    const signer = new DefaultSigner(key, 'fractal-testnet')
    fractalTestnetAddress = await signer.getAddress()
  }

  console.log('private key:', key.toWIF())
  console.log('btc-signet address:', btcSignetAddress)
  console.log('fractal-mainnet address:', fractalMainnetAddress)
  console.log('fractal-testnet address:', fractalTestnetAddress)
}

main()
