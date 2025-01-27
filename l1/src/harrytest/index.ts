import { TestWallet, DummyProvider } from 'scrypt-ts'
import * as ecc from '@bitcoinerlab/secp256k1'
import ECPairFactory, { ECPairInterface } from 'ecpair'
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'

import * as tap from '@cmdcode/tapscript'


const dummySigner = TestWallet.random(new DummyProvider())

const ECPair = ECPairFactory(ecc)
bitcoinjs.initEccLib(ecc)

const hex = ''
