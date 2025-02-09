import fetch from 'cross-fetch'
import { descriptorChecksum } from './checksum'
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
  const resp = await fetch(rpcUrl, {
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
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`createwallet failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`createwallet failed: ${JSON.stringify(res)}`)
  }
  return null
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
  const resp = await fetch(rpcWalletUrl(rpcUrl, walletName), {
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
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`importdescriptors failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`importdescriptors failed: ${JSON.stringify(res)}`)
  }
  if (res.result[0].success !== true) {
    throw new Error(`importdescriptors failed: ${JSON.stringify(res)}`)
  }
  return null
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

export type WalletInfo = {
  walletname: string
  walletversion: number
  format: string
  balance: number
  unconfirmed_balance: number
  immature_balance: number
  txcount: number
  keypoololdest: number
  keypoolsize: number
  keypoolsize_hd_internal: number
  unlocked_until: number
  paytxfee: number
  hdseedid: string
  private_keys_enabled: boolean
  avoid_reuse: boolean
  scanning: {
    duration: number
    progress: number
  }
  descriptors: boolean
}
export async function rpc_getwalletinfo(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string
): Promise<WalletInfo | Error> {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  const resp = await fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getwalletinfo',
      params: [],
    }),
  })
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`getwalletinfo failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`getwalletinfo failed: ${JSON.stringify(res)}`)
  }
  return res.result
}

export async function rpc_getbalance(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string
) {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  const resp = await fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getbalance',
      params: [],
    }),
  })
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`getbalance failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`getbalance failed: ${JSON.stringify(res)}`)
  }
  return res.result
}

export async function rpc_getdescriptorinfo(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string,
  desc: string
) {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  const resp = await fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getdescriptorinfo',
      params: [desc],
    }),
  })
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`getdescriptorinfo failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`getdescriptorinfo failed: ${JSON.stringify(res)}`)
  }
  return res.result
}

type AddressInfo = {
  address: string
  scriptPubKey: string
  ismine: boolean
  solvable: boolean
  iswatchonly: boolean
  isscript: boolean
  iswitness: boolean
  witness_version: number
  witness_program: string
  ischange: boolean
  labels: string[]
}
export async function rpc_getaddressinfo(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string,
  walletName: string,
  address: string
): Promise<AddressInfo> {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  const resp = await fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getaddressinfo',
      params: [address],
    }),
  })

  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`getaddressinfo failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`getaddressinfo failed: ${JSON.stringify(res)}`)
  }
  return res.result
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
  const resp = await fetch(rpcUrl, {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'getblockchaininfo',
      params: [],
    }),
  })
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`getblockchaininfo failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`getblockchaininfo failed: ${JSON.stringify(res)}`)
  }
  return res.result
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
  const resp = await fetch(rpcWalletUrl(rpcUrl, walletName), {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'rescanblockchain',
      params: [startHeight, endHeight],
    }),
  })
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(`rescanblockchain failed: ${resp.statusText}: ${text}`)
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`rescanblockchain failed: ${JSON.stringify(res)}`)
  }
  return res.result
}

type WalletName = string
export async function rpc_listwallets(
  rpcUrl: string,
  rpcUser: string,
  rpcPassword: string
): Promise<WalletName[]> {
  const Authorization = httpAuth(rpcUser, rpcPassword)
  const resp = await fetch(rpcUrl, {
    headers: { Authorization },
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'cat-cli',
      method: 'listwallets',
      params: [],
    }),
  })
  if (resp.status !== 200) {
    const text = await resp.text()
    throw new Error(
      `listwallets failed: ${resp.status}(${resp.statusText}): ${text}`
    )
  }
  const res = await resp.json()
  if (res.result === null || res.result === undefined) {
    throw new Error(`listwallets failed: ${JSON.stringify(res)}`)
  }
  return res.result
}
