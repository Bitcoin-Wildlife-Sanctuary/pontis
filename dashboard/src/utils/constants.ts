import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {OPERATOR_STATE_PATH} from './env';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = resolve(__dirname, '../..');

export const ABSOLUTE_OPERATOR_STATE_PATH = join(PACKAGE_ROOT, OPERATOR_STATE_PATH);
