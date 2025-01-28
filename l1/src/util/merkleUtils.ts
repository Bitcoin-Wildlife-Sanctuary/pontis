// used outside of contract

import { ByteString, hash256, Sha256, toByteString } from 'scrypt-ts'
import { MerklePath, Node, NodePos } from '../contracts/merklePath'
import { WithdrawalExpander } from '../contracts/withdrawalExpander'
import { cloneDeep } from 'lodash-es'

// node length = 32 bytes (sha256) + 8 bytes (amt)
export const WithdrawalLength = 32 + 8

export type MerkleLeafHash = ByteString // 32 bytes
export type MerkleProof = Array<Node>

function calcMerkleRoot(hashList: Array<Sha256>): Sha256 {
  if (hashList.length == 0) {
    throw new Error('hashList length must be greater than 0')
  }
  // if only one node, return it as merkle root
  if (hashList.length === 1) {
    return hashList[0]
  }

  const treeHeight = Math.log2(hashList.length)
  if (treeHeight % 1 != 0) {
    throw new Error('hashList length must be a power of 2')
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const newHashList = []
    for (let i = 0; i < hashList.length; i += 2) {
      const left = hashList[i]
      const right = hashList[i + 1]
      newHashList.push(Sha256(hash256(left + right)))
    }
    if (newHashList.length === 1) {
      return newHashList[0]
    }
    hashList = newHashList
  }
}

function calcMerkleProof(
  hashList: Array<Sha256>,
  nodeIndex: number
): MerkleProof {
  const proof: MerkleProof = []

  if (nodeIndex >= hashList.length) {
    throw new Error('nodeIndex out of bounds')
  }
  const treeHeight = Math.log2(hashList.length)
  if (treeHeight % 1 != 0 || treeHeight < 1) {
    throw new Error('hashList length must be a power of 2')
  }

  let targetHash = hashList[nodeIndex]
  let layerHashes = [...hashList]
  for (let i = 0; i < treeHeight; i++) {
    const nextLayerHashes = []
    for (let j = 0; j < layerHashes.length; j += 2) {
      const left = layerHashes[j]
      const right = layerHashes[j + 1]
      const nextLayerHash = Sha256(hash256(left + right))

      if (left === targetHash) {
        proof.push({ hash: right, pos: NodePos.Right })
        targetHash = nextLayerHash
      }
      if (right === targetHash) {
        proof.push({ hash: left, pos: NodePos.Left })
        targetHash = nextLayerHash
      }
      nextLayerHashes.push(nextLayerHash)
    }
    layerHashes = nextLayerHashes
  }
  return proof
}

export type BatchID = string
export type BatchMerkleTree = Array<BatchID> & { length: 16 }
export class BridgeMerkle {
  static readonly EMPTY_BATCH_ID: BatchID = Sha256(MerklePath.NULL_NODE)

  static getEmptyTree(): BatchMerkleTree {
    const arr: BatchID[] = []
    for (let i = 0; i < 16; i++) {
      arr.push(BridgeMerkle.EMPTY_BATCH_ID)
    }
    return arr as BatchMerkleTree
  }

  static getEmptyMerkleRoot() {
    const tree = BridgeMerkle.getEmptyTree()
    return this.calcMerkleRoot(tree)
  }

  static calcMerkleRoot(tree: BatchMerkleTree) {
    if (tree.length > 16) {
      throw new Error('nodes exceed max 16')
    }
    return calcMerkleRoot(tree as Array<Sha256>)
  }

  static getMerkleProof(tree: BatchMerkleTree, nodeIndex: number) {
    if (tree.length > 16) {
      throw new Error('nodes exceed max 16')
    }
    return calcMerkleProof(tree as Array<Sha256>, nodeIndex)
  }
}

export type Withdrawal = {
  l1Address: ByteString // p2wpkh address
  amt: bigint
}
export type WithdrawalNode = {
  hash: Sha256
  amt: bigint
  level: bigint
  withdrawals: Array<Withdrawal>
}
// todo: add a hash prefix to avoid tree collision
export class WithdrawalMerkle {
  private static calculateMerkle(withdrawalList: Array<Withdrawal>): {
    root: Sha256
    levels: WithdrawalNode[][]
  } {
    let startLevel = 0n
    if (withdrawalList.length == 0) {
      throw new Error('withdrawalList length must be greater than 0')
    }
    if (withdrawalList.length === 1) {
      return {
        root: WithdrawalExpander.getLeafNodeHash(
          withdrawalList[0].l1Address,
          withdrawalList[0].amt
        ),
        levels: [
          [
            {
              hash: WithdrawalExpander.getLeafNodeHash(
                withdrawalList[0].l1Address,
                withdrawalList[0].amt
              ),
              amt: withdrawalList[0].amt,
              level: startLevel,
              withdrawals: [withdrawalList[0]],
            },
          ],
        ],
      }
    }

    const treeHeight = Math.log2(withdrawalList.length)
    if (treeHeight % 1 != 0) {
      throw new Error('withdrawalList length must be a power of 2')
    }

    let leafHashes: Array<WithdrawalNode> = withdrawalList.map((withdrawal) => {
      return {
        hash: WithdrawalExpander.getLeafNodeHash(
          withdrawal.l1Address,
          withdrawal.amt
        ),
        amt: withdrawal.amt,
        level: startLevel,
        withdrawals: [withdrawal],
      }
    })

    const levels: WithdrawalNode[][] = []
    levels.unshift(leafHashes)

    // eslint-disable-next-line no-constant-condition
    while (true) {
      startLevel += 1n
      const newLeafHashes: Array<WithdrawalNode> = []

      for (let i = 0; i < leafHashes.length; i += 2) {
        const left = leafHashes[i]
        const right = leafHashes[i + 1]
        newLeafHashes.push({
          hash: WithdrawalExpander.getNodeHash(
            startLevel,
            left.amt,
            left.hash,
            right.amt,
            right.hash
          ),
          amt: left.amt + right.amt,
          level: startLevel,
          withdrawals: [...left.withdrawals, ...right.withdrawals],
        })
      }
      levels.unshift(newLeafHashes)
      if (newLeafHashes.length === 1) {
        return {
          root: newLeafHashes[0].hash,
          levels: levels,
        }
      }
      leafHashes = newLeafHashes
    }
    throw new Error('should not reach here')
  }

  static getMerkleRoot(withdrawals: Withdrawal[]) {
    withdrawals = cloneDeep(withdrawals)
    if (withdrawals.length == 0) {
      throw new Error('withdrawals length must be greater than 0')
    }
    const treeHeight = Math.ceil(Math.log2(withdrawals.length))
    const totalLeafCount = 1 << treeHeight
    // padRight empty leafHashes
    while (totalLeafCount > withdrawals.length) {
      withdrawals.push({
        l1Address: toByteString(''),
        amt: 0n,
      })
    }
    return this.calculateMerkle(withdrawals).root
  }

  static getMerkleLevels(withdrawals: Withdrawal[]) {
    withdrawals = cloneDeep(withdrawals)
    if (withdrawals.length == 0) {
      throw new Error('withdrawals length must be greater than 0')
    }
    const treeHeight = Math.ceil(Math.log2(withdrawals.length))
    const totalLeafCount = 1 << treeHeight
    // padRight empty leafHashes
    while (totalLeafCount > withdrawals.length) {
      withdrawals.push({
        l1Address: toByteString(''),
        amt: 0n,
      })
    }
    return this.calculateMerkle(withdrawals).levels
  }

  static getHashChildren(allWithdrawals: Withdrawal[], currentHash: Sha256) {
    const levels = this.getMerkleLevels(allWithdrawals).flat()
    const currentIndex = levels.findIndex((node) => node.hash === currentHash)
    if (currentIndex === -1) {
      throw new Error('currentHash not found in any level')
    }
    const currentNode = levels[currentIndex]
    if (currentNode.withdrawals.length == 1) {
      throw new Error('currentNode can not be leaf node')
    }

    // for an node at index i, its children are at index 2i+1 and 2i+2
    // https://www.geeksforgeeks.org/binary-heap/
    const leftChild = levels[currentIndex * 2 + 1]
    const rightChild = levels[currentIndex * 2 + 2]
    return {
      leftChild,
      rightChild,
    }
  }

  static checkWithdrawalValid(withdrawal: Withdrawal) {
    // todo: check address is valid
    if (withdrawal.amt <= 0n) {
      throw new Error('withdrawal amt must be greater than 0')
    }
  }
}

/**

withdrwalExpander

leaf: address + amt;
leafHash = sha256( level=0 + sha256(leaf));
nodeHash = sha256( level + leftAmt + leftChildNodeHash + rightAmt + rightChildNodeHash);

state = sha256(nodeHash1, nodeHash2)


depositAggregator

leaf: address(l2) + amt;
leafHash = sha256( level=0 + sha256(leaf));
nodeHash = sha256( level + leftChildNodeHash + rightChildNodeHash);

state = sha256(nodeHash1, nodeHash2)
 */
