// We're disabling the eslint rule, and checking env variables manually.
/* eslint-disable @typescript-eslint/no-non-null-assertion */

export const OPERATOR_STATE_PATH = process.env.OPERATOR_STATE_PATH!;

if (!OPERATOR_STATE_PATH) {
  throw new Error('OPERATOR_STATE_PATH is not defined');
}
