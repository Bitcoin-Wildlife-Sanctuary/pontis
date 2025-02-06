import { DefaultSigner } from '../../src/signers'
import * as ecc from '@bitcoinerlab/secp256k1'
import ECPairFactory from 'ecpair'
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'
import { PRIVATE_KEY } from './env'


const ECPair = ECPairFactory(ecc)
bitcoinjs.initEccLib(ecc)

export const testOperatorSigner = new DefaultSigner(
  ECPair.fromWIF(PRIVATE_KEY || 'L1JbUDfaoHEwJMc1V8LJ1G95WQEqoUAWBQQquAUHTuSsBYRmXx63')
)
export const testUserSigner = new DefaultSigner(
  ECPair.fromWIF(PRIVATE_KEY || 'Kz9ZzgUXZWTmWzkyxc7i9QvRXRdKrwbmRULuJNYE8XutmJcegkMi')
)

export async function createRandomAddress() {
  const signer = new DefaultSigner(ECPair.makeRandom())
  return await signer.getAddress()
}
