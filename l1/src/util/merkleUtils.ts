// used outside of contract

import { ByteString, hash256, len, Sha256, toByteString } from 'scrypt-ts'
import { MerklePath, Node, NodePos } from '../contracts/merklePath'
import { WithdrawalExpander } from '../contracts/withdrawalExpander'
import { cloneDeep } from 'lodash-es'
import { WithdrawalExpanderCovenant, WithdrawalExpanderState } from '../covenants/index'
import { isP2trScript, isP2wpkhScript, isP2wshScript } from '../lib/utils'

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
export const BATCH_MERKLE_TREE_LENGTH = 16;
export type BatchId = string
export type BatchMerkleTree = Array<BatchId> & { length: typeof BATCH_MERKLE_TREE_LENGTH }
export class BridgeMerkle {
  static readonly EMPTY_BATCH_ID: BatchId = Sha256(MerklePath.NULL_NODE)

  static getEmptyTree(): BatchMerkleTree {
    const arr: BatchId[] = []
    for (let i = 0; i < BATCH_MERKLE_TREE_LENGTH; i++) {
      arr.push(BridgeMerkle.EMPTY_BATCH_ID)
    }
    return arr as BatchMerkleTree
  }

  static getEmptyMerkleRoot() {
    const tree = BridgeMerkle.getEmptyTree()
    return this.calcMerkleRoot(tree)
  }

  static calcMerkleRoot(tree: BatchMerkleTree) {
    if (tree.length > BATCH_MERKLE_TREE_LENGTH) {
      throw new Error('nodes exceed max BATCH_MERKLE_TREE_LENGTH')
    }
    return calcMerkleRoot(tree as Array<Sha256>)
  }

  static getMerkleProof(tree: BatchMerkleTree, nodeIndex: number) {
    if (tree.length > BATCH_MERKLE_TREE_LENGTH) {
      throw new Error('nodes exceed max BATCH_MERKLE_TREE_LENGTH')
    }
    return calcMerkleProof(tree as Array<Sha256>, nodeIndex)
  }
}

export type ExpansionMerkleTree = {
  root: Sha256
  levels: WithdrawalNode[][]
}

export type Withdrawal = {
  l1Address: ByteString // p2wpkh address
  amt: bigint
}
export type WithdrawalNode = {
  hash: Sha256
  amt: bigint
  level: number
  withdrawals: Array<Withdrawal>
}


export type WithdrawalExpansionNode = {
  type: 'LEAF',
  hash: Sha256
  total: bigint,
  l1Address: ByteString
} | {
  type: 'INNER',
  hash: Sha256
  total: bigint,
  left: WithdrawalExpansionNode,
  right: WithdrawalExpansionNode
} | {
  type: 'EMPTY',
  hash: Sha256,
  total: 0n
}

const EMPTY_HASH = WithdrawalExpander.getLeafNodeHash(toByteString(''), 0n);

export function getExpansionTree(withdrawals: Array<Withdrawal>): WithdrawalExpansionNode {
  
  let level: WithdrawalExpansionNode[] = withdrawals.map(w => ({
    type: 'LEAF',
    hash: WithdrawalExpander.getLeafNodeHash(w.l1Address, w.amt),
    total: w.amt,
    l1Address: w.l1Address
  }));

  const paddedLenght = Math.pow(2, Math.ceil(Math.log2(level.length)));
  while (paddedLenght > level.length) {
    level.push({
      type: 'EMPTY',
      hash: EMPTY_HASH,
      total: 0n,
    })
  }

  while (level.length > 1) {
    const nextLevel: WithdrawalExpansionNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1];
      const total = left.total + right.total;
      const hash = WithdrawalExpander.getBranchNodeHash(
        left.total,
        left.hash,
        right.total,
        right.hash
      );
      nextLevel.push({
        type: 'INNER',
        hash,
        total,
        left,
        right,
      });
    }
    level = nextLevel;
  }
  return level[0];
}

export function getNthLevelNodes(node: WithdrawalExpansionNode, level: number): WithdrawalExpansionNode[] {
  if (level === 0) {
    return [node];
  }
  
  if (node.type !== 'INNER') {
    throw new Error('node is not an inner node, level too deep?');
  }
  
  return [
    ...getNthLevelNodes(node.left, level - 1),
    ...getNthLevelNodes(node.right, level - 1)
  ];
}

export function leafNodes(
  node: WithdrawalExpansionNode
): Exclude<WithdrawalExpansionNode, { type: 'INNER' }>[] {
  if (node.type === 'LEAF' || node.type === 'EMPTY') {
    return [node];
  } else {
    return [...leafNodes(node.left), ...leafNodes(node.right)];
  }
}

export function withdrawalExpandedStateFromNode(n: WithdrawalExpansionNode): WithdrawalExpanderState {
  switch(n.type) {
    case 'LEAF':
      return WithdrawalExpanderCovenant.createLeafState(
        n.l1Address,
        n.total
      );
    case 'INNER':
      return WithdrawalExpanderCovenant.createNonLeafState(
        n.left.hash,
        n.right.hash,
        n.left.total,
        n.right.total
      );
    case 'EMPTY':
      return WithdrawalExpanderCovenant.createLeafState(
        toByteString(''),
        0n
      );
  }
}


// todo: maybe add a hash prefix to avoid tree collision
// export class WithdrawalMerkle {
//   private static calculateMerkle(withdrawalList: Array<Withdrawal>): ExpansionMerkleTree {
//     let startLevel = 0
//     if (withdrawalList.length == 0) {
//       throw new Error('withdrawalList length must be greater than 0')
//     }
//     if (withdrawalList.length === 1) {
//       return {
//         root: WithdrawalExpander.getLeafNodeHash(
//           withdrawalList[0].l1Address,
//           withdrawalList[0].amt
//         ),
//         levels: [
//           [
//             {
//               hash: WithdrawalExpander.getLeafNodeHash(
//                 withdrawalList[0].l1Address,
//                 withdrawalList[0].amt
//               ),
//               amt: withdrawalList[0].amt,
//               level: startLevel,
//               withdrawals: [withdrawalList[0]],
//             },
//           ],
//         ],
//       }
//     }

//     const treeHeight = Math.log2(withdrawalList.length)
//     if (treeHeight % 1 != 0) {
//       throw new Error('withdrawalList length must be a power of 2')
//     }

//     let leafHashes: Array<WithdrawalNode> = withdrawalList.map((withdrawal) => {
//       return {
//         hash: WithdrawalExpander.getLeafNodeHash(
//           withdrawal.l1Address,
//           withdrawal.amt
//         ),
//         amt: withdrawal.amt,
//         level: startLevel,
//         withdrawals: [withdrawal],
//       }
//     })

//     const levels: WithdrawalNode[][] = []
//     levels.unshift(leafHashes)

//     // eslint-disable-next-line no-constant-condition
//     while (true) {
//       startLevel += 1
//       const newLeafHashes: Array<WithdrawalNode> = []

//       for (let i = 0; i < leafHashes.length; i += 2) {
//         const left = leafHashes[i]
//         const right = leafHashes[i + 1]
//         newLeafHashes.push({
//           hash: WithdrawalExpander.getBranchNodeHash(
//             left.amt,
//             left.hash,
//             right.amt,
//             right.hash
//           ),
//           amt: left.amt + right.amt,
//           level: startLevel,
//           withdrawals: [...left.withdrawals, ...right.withdrawals],
//         })
//       }
//       levels.unshift(newLeafHashes)
//       if (newLeafHashes.length === 1) {
//         return {
//           root: newLeafHashes[0].hash,
//           levels: levels,
//         }
//       }
//       leafHashes = newLeafHashes
//     }
//     throw new Error('should not reach here')
//   }

//   private static padEmptyWithdrawals(withdrawals: Withdrawal[]) {
//     const treeHeight = Math.ceil(Math.log2(withdrawals.length))
//     const totalLeafCount = 1 << treeHeight
//     // padRight empty leafHashes
//     while (totalLeafCount > withdrawals.length) {
//       withdrawals.push({
//         l1Address: toByteString(''),
//         amt: 0n,
//       })
//     }
//     return withdrawals
//   }

//   static getMerkleTree(withdrawals: Withdrawal[]) {
//     withdrawals = cloneDeep(withdrawals)
//     withdrawals = this.padEmptyWithdrawals(withdrawals)
//     return this.calculateMerkle(withdrawals)
//   }

//   static getMerkleRoot(withdrawals: Withdrawal[]) {
//     withdrawals = cloneDeep(withdrawals)
//     withdrawals = this.padEmptyWithdrawals(withdrawals)
//     return this.calculateMerkle(withdrawals).root
//   }

//   static getRootState(withdrawals: Withdrawal[]): WithdrawalExpanderState {
//     withdrawals = cloneDeep(withdrawals)
//     withdrawals = this.padEmptyWithdrawals(withdrawals)
//     const levels = this.getMerkleLevels(withdrawals)
//     if (levels.length === 1) {
//       return WithdrawalExpanderCovenant.createLeafState(
//         withdrawals[0].l1Address,
//         withdrawals[0].amt
//       )
//     } else {
//       return WithdrawalExpanderCovenant.createNonLeafState(
//         levels[1][0].hash,
//         levels[1][1].hash,
//         levels[1][0].amt,
//         levels[1][1].amt
//       )
//     }
//   }

//   static assertHashExists(allWithdrawals: Withdrawal[], hash: Sha256) {
//     const levels = this.getMerkleLevels(allWithdrawals)
//     const node = levels.flat().find((v) => v.hash === hash)
//     if (!node) {
//       throw new Error(`expander hash: ${hash} not found in any level`)
//     }
//     return node
//   }

//   static getStateForHashFromTree(tree: ExpansionMerkleTree, hash: Sha256) {
//     const levels = tree.levels;
//     const node = levels.flat().find((v) => v.hash === hash)
//     if (node.level === 0) {
//       return WithdrawalExpanderCovenant.createLeafState(
//         node.withdrawals[0].l1Address,
//         node.withdrawals[0].amt
//       )
//     } else {
//       const children = this.getHashChildrenFromTree(tree, hash)
//       return WithdrawalExpanderCovenant.createNonLeafState(
//         children.leftChild.hash,
//         children.rightChild.hash,
//         children.leftChild.amt,
//         children.rightChild.amt
//       )
//     }
//   }

//   static getStateForHash(allWithdrawals: Withdrawal[], hash: Sha256) {
//     this.assertHashExists(allWithdrawals, hash)
//     const levels = this.getMerkleLevels(allWithdrawals)
//     const node = levels.flat().find((v) => v.hash === hash)
//     if (node.level === 0) {
//       return WithdrawalExpanderCovenant.createLeafState(
//         node.withdrawals[0].l1Address,
//         node.withdrawals[0].amt
//       )
//     } else {
//       const children = this.getHashChildren(allWithdrawals, hash)
//       return WithdrawalExpanderCovenant.createNonLeafState(
//         children.leftChild.hash,
//         children.rightChild.hash,
//         children.leftChild.amt,
//         children.rightChild.amt
//       )
//     }
//   }

//   static getMerkleLevels(withdrawals: Withdrawal[]) {
//     if (withdrawals.length == 0) {
//       throw new Error('withdrawals length must be greater than 0')
//     }
//     withdrawals = cloneDeep(withdrawals)
//     withdrawals = this.padEmptyWithdrawals(withdrawals)
//     return this.calculateMerkle(withdrawals).levels
//   }

//   static getHashChildren(allWithdrawals: Withdrawal[], currentHash: Sha256) {
//     const levels = this.getMerkleLevels(allWithdrawals).flat()
//     const currentIndex = levels.findIndex((node) => node.hash === currentHash)
//     if (currentIndex === -1) {
//       throw new Error('currentHash not found in any level')
//     }
//     const currentNode = levels[currentIndex]
//     if (currentNode.withdrawals.length == 1) {
//       throw new Error('currentNode can not be leaf node')
//     }

//     // for an node at index i, its children are at index 2i+1 and 2i+2
//     // https://www.geeksforgeeks.org/binary-heap/
//     const leftChild = levels[currentIndex * 2 + 1]
//     const rightChild = levels[currentIndex * 2 + 2]
//     return {
//       leftChild,
//       rightChild,
//     }
//   }

//   static getHashChildrenFromTree(tree: ExpansionMerkleTree, currentHash: Sha256) {
//     const levels = tree.levels.flat()
//     const currentIndex = levels.findIndex((node) => node.hash === currentHash)
//     if (currentIndex === -1) {
//       throw new Error('currentHash not found in any level')
//     }
//     const currentNode = levels[currentIndex]
//     if (currentNode.withdrawals.length == 1) {
//       throw new Error('currentNode can not be leaf node')
//     }

//     // for an node at index i, its children are at index 2i+1 and 2i+2
//     // https://www.geeksforgeeks.org/binary-heap/
//     const leftChild = levels[currentIndex * 2 + 1]
//     const rightChild = levels[currentIndex * 2 + 2]
//     return {
//       leftChild,
//       rightChild,
//     }
//   }


//   static checkWithdrawalValid(withdrawal: Withdrawal) {
//     // todo: check address is valid
//     if (withdrawal.amt <= 0n) {
//       throw new Error('withdrawal amt must be greater than 0')
//     }
//     // only support witness script
//     // p2tr script: 5120 + tweakedPubKey(32 bytes)
//     if (!isP2trScript(withdrawal.l1Address) && !isP2wshScript(withdrawal.l1Address) && !isP2wpkhScript(withdrawal.l1Address)) {
//       throw new Error('withdrawal address must be p2tr, p2wsh or p2wpkh script')
//     }
//   }

//   static getNodeForHashFromTree(tree: ExpansionMerkleTree, hash: Sha256) {
//     const levels = tree.levels;
//     return levels.flat().find((v) => v.hash === hash)
//   }

// }

