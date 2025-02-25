import {
  method,
  SmartContractLib,
  hash256,
  Sha256,
  FixedArray,
  ByteString,
  toByteString,
  assert,
  int2ByteString,
  prop,
} from 'scrypt-ts'

/**
 * The maximum depth of the merkle proof.
 */
export const MERKLE_PROOF_MAX_DEPTH = 4

/**
 * The position of the node in the merkle tree.
 */
export enum NodePos {
  Left,
  Right,
}

/**
 * The node of merkle proof.
 */
export type Node = {
  /**
   * The hash of the sibling node.
   */
  hash: ByteString
  /**
   * The position of the sibling node.
   */
  pos: NodePos
}

/**
 * The merkle proof.
 */
export type MerkleProof = FixedArray<Node, typeof MERKLE_PROOF_MAX_DEPTH> // If shorter than max depth, pad with invalid nodes.

/**
 * The merkle path utility.
 */
export class MerklePath extends SmartContractLib {
  @prop()
  static readonly NULL_NODE: Sha256 = Sha256(
    toByteString(
      '0000000000000000000000000000000000000000000000000000000000000000'
    )
  )

  /**
   * Calculate the merkle root.
   * @param leaf - The leaf node hash
   * @param merkleProof - The merkle proof.
   * @returns The merkle root.
   */
  @method()
  static calcMerkleRoot(leaf: Sha256, merkleProof: MerkleProof): Sha256 {
    let root = leaf
    for (let i = 0; i < MERKLE_PROOF_MAX_DEPTH; i++) {
      const node = merkleProof[i]
      root =
        node.pos == NodePos.Left
          ? Sha256(hash256(node.hash + root))
          : Sha256(hash256(root + node.hash))
    }
    return root
  }

  /**
   * Check level is valid, support max 8 levels
   * @param level
   */
  @method()
  static checkLevelValid(level: bigint): boolean {
    assert(level >= 0 && level <= 8)
    return true
  }

  /**
   * Convert level to byte string.
   * @param level - The level.
   * @returns The byte string.
   */
  @method()
  static levelToByteString(level: bigint): ByteString {
    return int2ByteString(level)
  }
}
