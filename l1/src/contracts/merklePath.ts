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

export const MERKLE_PROOF_MAX_DEPTH = 4

/*
 - on the left
 - on the right
*/
export enum NodePos {
  Left,
  Right,
}

export type Node = {
  hash: ByteString
  pos: NodePos
}

export const NODE_LENGTH = 32

// todo: confirm the depth of bridge state merkle tree
export type MerkleProof = FixedArray<Node, typeof MERKLE_PROOF_MAX_DEPTH> // If shorter than max depth, pad with invalid nodes.

export type IntermediateValues = FixedArray<
  ByteString,
  typeof MERKLE_PROOF_MAX_DEPTH
>

export class MerklePath extends SmartContractLib {
  @prop()
  static readonly NULL_NODE: Sha256 = Sha256(
    toByteString(
      '0000000000000000000000000000000000000000000000000000000000000000'
    )
  )

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
   * @param level
   * @returns
   */
  @method()
  static levelToByteString(level: bigint): ByteString {
    return int2ByteString(level, 1n)
  }
}
