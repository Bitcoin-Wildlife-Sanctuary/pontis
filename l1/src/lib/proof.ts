import { fill } from 'scrypt-ts'
import { toByteString } from 'scrypt-ts'
import { MAX_OUTPUT } from '../contracts/txUtil'

export const emptyString = toByteString('')

export const emptyFixedArray = function () {
  return fill(emptyString, MAX_OUTPUT)
}
