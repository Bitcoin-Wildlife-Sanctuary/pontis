/* eslint-disable prettier/prettier */
import type {
  AccumulatedExpansionTx,
  L1Tx,
  OperatorState,
  WithdrawalExpansionInnerNode,
  WithdrawalExpansionNode,
} from '@/types';

export function parseOperatorState(raw: string): OperatorState {
  return JSON.parse(raw, (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }

    return value;
  });
}

export function convertTreeToArray(root: WithdrawalExpansionNode): (WithdrawalExpansionNode | null)[][] {
  const result: (WithdrawalExpansionNode | null)[][] = [];

  function traverse(node: WithdrawalExpansionNode, level: number) {
    if (!node) return;

    // Ensure the current level exists in the result array
    if (result.length <= level) {
      result.push([]);
    }

    let left: WithdrawalExpansionInnerNode['left'] | undefined;
    if ('left' in node) left = node.left;

    let right: WithdrawalExpansionInnerNode['right'] | undefined;
    if ('right' in node) right = node.right;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {left: _, right: __, ...nodeWithoutChildren} = node as any;

    result[level].push(nodeWithoutChildren);

    if (left) traverse(left, level + 1);
    if (right) traverse(right, level + 1);
  }

  // Start the traversal from the root at level 0
  traverse(root, 0);

  return result.reduce(
    (acc, level, levelIdx) => {
      const requiredLength = levelIdx * 2 || 1;

      if (level.length < requiredLength) {
        acc.push([...level, ...Array.from({length: requiredLength - level.length}, () => null)]);
      } else {
        acc.push(level);
      }

      return acc;
    },
    [] as typeof result,
  );
}

export function fillExpansionTxs(
  expansionTree: WithdrawalExpansionNode,
  expansionTxs: L1Tx[][],
): AccumulatedExpansionTx[][] {
  const treeArray = convertTreeToArray(expansionTree);

  const result: AccumulatedExpansionTx[][] = [];

  expansionTxs.forEach((level, levelIdx) => {
    const levelTxs: AccumulatedExpansionTx[] = [];

    // for each tx in the current level, check if there is a corresponding node in the tree
    // if there is, add the node's type, hash, address, and total to the tx
    // if there isn't, add the tx as is
    level.forEach((tx, txIdx) => {
      const node = treeArray[levelIdx]?.[txIdx];

      if (!node || node.type === 'EMPTY') {
        levelTxs.push(tx ?? null);
        return;
      }

      levelTxs.push({
        ...tx,
        nodeType: node.type,
        nodeHash: node.hash,
        address: 'l1Address' in node ? node.l1Address : undefined,
        total: 'total' in node ? node.total : undefined,
      });
    });

    result.push(levelTxs);
  });

  return result;
}
