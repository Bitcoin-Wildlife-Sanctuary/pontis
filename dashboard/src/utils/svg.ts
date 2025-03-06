import {Cords, FromToCords} from '@/types';

export const drawLineFromTo = (from: Cords, to: Cords, midGapMultiplier = 0.5) => {
  const leftSideWidth = (to.x - from.x) * midGapMultiplier;

  return `M${from.x},${from.y} l ${leftSideWidth} 0 l 0 ${to.y - from.y} l ${to.x - leftSideWidth} 0`;
};

export const getFromToCords = (svgRect: DOMRect, fromRect: DOMRect, toRect: DOMRect): FromToCords => {
  const fromX = fromRect.right - svgRect.left;
  const fromMidY = fromRect.top + fromRect.height / 2;
  const fromY = fromMidY - svgRect.top;

  const toX = toRect.left - svgRect.left;
  const toMidY = toRect.top + toRect.height / 2;
  const toY = toMidY - svgRect.top;

  return {from: {x: fromX, y: fromY}, to: {x: toX, y: toY}};
};
