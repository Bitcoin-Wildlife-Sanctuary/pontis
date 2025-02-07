import fetch from 'cross-fetch'
import { descriptorChecksum } from './checksum'
import { addressToScript } from '../lib/utils'
import * as ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'

bitcoinjs.initEccLib(ecc)

function httpAuth(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
}

function rpcWalletUrl(url: string, walletName: string) {
  return `${url}/wallet/${walletName}`
}

export async function rpc_create_watchonly_wallet(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string
): Promise<null | Error> {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  return fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'l1-cli',
      method: 'createwallet',
      params: {
        wallet_name: walletName,
        disable_private_keys: true,
        blank: true,
        passphrase: '',
        descriptors: true,
        load_on_startup: true,
      },
    }),
  })
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })
    .then((res: any) => {
      if (res.result === null) {
        throw new Error(JSON.stringify(res))
      }
      return null
    })
    .catch((err: Error) => {
      console.log('rpc_create_watchonly_wallet failed', err)
      return err
    })
}

export const rpc_importdescriptors = async function (
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string,
  desc: string
): Promise<null | Error> {
  const Authorization = httpAuth(rpcUser, rpcPassword)

  const checksum = descriptorChecksum(desc)

  const timestamp = Math.ceil(new Date().getTime() / 1000)
  return fetch(rpcWalletUrl(rpcUrl, walletName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'importdescriptors',
      params: [
        [
          {
            desc: `${desc}#${checksum}`,
            active: false,
            index: 0,
            internal: false,
            timestamp,
            label: '',
          },
        ],
      ],
    }),
  })
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })
    .then((res: any) => {
      if (
        res.result === null ||
        res.result[0] === undefined ||
        res.result[0].success !== true
      ) {
        throw new Error(JSON.stringify(res))
      }
      return null
    })
    .catch((e: Error) => {
      return e
    })
}

export async function rpc_importaddress(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string,
  address: string
): Promise<null | Error> {
  const desc = `addr(${address})`
  return rpc_importdescriptors(rpcUrl, rpcUser, rpcPassword, walletName, desc)
}

export async function rpc_getwalletinfo(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string
): Promise<any | Error> {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  return fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getwalletinfo',
      params: [],
    }),
  })
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })
    .then((res: any) => {
      if (res.result === null) {
        throw new Error(JSON.stringify(res))
      }
      return res.result
    })
    .catch((e: Error) => {
      console.error('rpc_getwalletinfo failed', e)
      return e
    })
}

export async function rpc_getbalance(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string
) {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  return fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getbalance',
      params: [],
    }),
  })
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })  
    .then((res: any) => {
      if (res.result === null) {
        throw new Error(JSON.stringify(res))
      }
      return res.result
    })
    .catch((e: Error) => {
      return e
    })  
}   

export async function rpc_getdescriptorinfo(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string,
  desc: string
) {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  return fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getdescriptorinfo',
      params: [desc],
    }),
  })
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })
    .then((res: any) => {
      if (res.result === null) {
        throw new Error(JSON.stringify(res))
      }
      return res.result
    })
    .catch((e: Error) => {
      return e
    })
}

export async function rpc_getaddressinfo(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string,
  address: string
) {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  return fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getaddressinfo',
      params: [address],
    }),
  })
    .then((res) => {    
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })
    .then((res: any) => {
      if (res.result === null) {
        throw new Error(JSON.stringify(res))
      }
      return res.result
    })
    .catch((e: Error) => {
      return e
    })
}

export type BlockchainInfo = {
  chain: string
  blocks: number
  headers: number
  bestblockhash: string
  difficulty: number
  mediantime: number
  verificationprogress: number
  initialblockdownload: boolean
  chainwork: string
  size_on_disk: number
  pruned: boolean
  pruneheight: number
  automatic_pruning: boolean
  prune_target_size: number
}
export async function rpc_getblockchaininfo(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string
) {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  return fetch(rpcUrl, {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getblockchaininfo',
      params: [],
    }),
  })
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })
    .then((res: any) => {
      return res.result
    })
    .catch((e: Error) => {
      return e
    })
}

export async function rpc_rescanblockchain(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string,
  startHeight: number,
  endHeight: number
) {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  return fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'rescanblockchain',
      params: [startHeight, endHeight],
    }),
  })    
    .then((res) => {
      if (res.status === 200) {
        return res.json()
      }
      throw new Error(res.statusText)
    })  
    .then((res: any) => {
      if (res.result === null) {
        throw new Error(JSON.stringify(res))
      }
      return res.result
    })
    .catch((e: Error) => {
      return e
    })  
}   

/**

guide for index an address/make rpc return utxo of an address
1. create a watchonly wallet by calling rpc_create_watchonly_wallet
2. import the address to the wallet by calling rpc_importaddress
3. call rpc_rescanblockchain to index the address

 */
