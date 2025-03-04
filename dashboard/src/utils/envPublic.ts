// We're disabling the eslint rule, and checking env variables manually.
/* eslint-disable @typescript-eslint/no-non-null-assertion */

export const L1_EXPLORER_LINK = process.env.NEXT_PUBLIC_L1_EXPLORER_LINK!;
export const L2_EXPLORER_LINK = process.env.NEXT_PUBLIC_L2_EXPLORER_LINK!;

if (!L1_EXPLORER_LINK) {
  throw new Error('L1_EXPLORER_LINK is not defined');
}

if (!L2_EXPLORER_LINK) {
  throw new Error('L2_EXPLORER_LINK is not defined');
}
