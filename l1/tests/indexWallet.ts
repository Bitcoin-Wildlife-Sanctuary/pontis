import {
  rpc_create_watchonly_wallet,
  rpc_getaddressinfo,
  rpc_getblockchaininfo,
  rpc_importaddress,
  rpc_listwallets,
  rpc_rescanblockchain,
} from '../src/util/rpc'
import { PRIVATE_KEY, rpc_config } from './utils/env'
import { testOperatorSigner } from './utils/testSigner'

/**

guide for index an address/make rpc return utxo of an address
1. create a watchonly wallet by calling rpc_create_watchonly_wallet
2. import the address to the wallet by calling rpc_importaddress
3. call rpc_rescanblockchain to index the address

 */

const main = async () => {
  if (
    !rpc_config.host ||
    !rpc_config.user ||
    !rpc_config.password ||
    !rpc_config.wallet
  ) {
    throw new Error(
      'RPC_HOST, RPC_USER, RPC_PASSWORD, and RPC_WALLET must be set'
    )
  }
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY must be set')
  }
  const address = await testOperatorSigner.getAddress()
  console.log('address', address)

  const blockchainInfo = await rpc_getblockchaininfo(
    rpc_config.host,
    rpc_config.user,
    rpc_config.password
  )
  console.log('blockchainInfo', blockchainInfo)

  const walletList = await rpc_listwallets(
    rpc_config.host,
    rpc_config.user,
    rpc_config.password
  )
  console.log('walletList', walletList)
  console.log(`wallet list in node: ${walletList.join(', ')}`)
  const isWalletExists = walletList.some(
    (walletName) => walletName === rpc_config.wallet
  )
  console.log(
    `wallet ${rpc_config.wallet} ${
      isWalletExists ? 'exists' : 'does not exist'
    }`
  )
  if (!isWalletExists) {
    console.log(`creating wallet ${rpc_config.wallet}`)
    await rpc_create_watchonly_wallet(
      rpc_config.host,
      rpc_config.user,
      rpc_config.password,
      rpc_config.wallet
    )
  }

  // address
  const addressInfo = await rpc_getaddressinfo(
    rpc_config.host,
    rpc_config.user,
    rpc_config.password,
    rpc_config.wallet,
    address
  )
  if (addressInfo.ismine) {
    console.log('address is already in wallet, do not rescan')
  } else {
    console.log('importing address to wallet')
    await rpc_importaddress(
      rpc_config.host,
      rpc_config.user,
      rpc_config.password,
      rpc_config.wallet,
      address
    )

    const startBlock = blockchainInfo.blocks - 1000
    const endBlock = blockchainInfo.blocks
    console.log(`rescanning blockchain from ${startBlock} to ${endBlock}`)
    await rpc_rescanblockchain(
      rpc_config.host,
      rpc_config.user,
      rpc_config.password,
      rpc_config.wallet,
      startBlock,
      endBlock
    )
  }
}

main()
