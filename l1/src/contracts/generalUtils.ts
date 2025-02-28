import {
  SmartContractLib,
  method,
  ByteString,
  int2ByteString,
  toByteString,
  assert,
  prop,
  len,
  OpCode,
  Addr,
} from 'scrypt-ts'

export class GeneralUtils extends SmartContractLib {
  @prop()
  static readonly NULL_ADDRESS: Addr = Addr(
    toByteString('0000000000000000000000000000000000000000')
  )

  @prop()
  static readonly L2_ADDRESS_LENGTH: bigint = 32n

  @method()
  static padAmt(amt: bigint): ByteString {
    // note: here only allow max 21.47483647 BTC, otherwise it thows. the reason is bitcoin vm only support int32 math
    // todo: add support for more than 21.47483647 BTC

    // check the amt is less or equal than int32.max, avoid overflow
    assert(amt <= 0x7fffffff)

    assert(amt >= 0n)
    // const res = int2ByteString(amt, 8n)
    let res = int2ByteString(amt)
    if (len(res) == 0n) {
      res = toByteString('0000000000000000')
    } else if (len(res) == 1n) {
      res = res + toByteString('00000000000000')
    } else if (len(res) == 2n) {
      res = res + toByteString('000000000000')
    } else if (len(res) == 3n) {
      res = res + toByteString('0000000000')
    } else if (len(res) == 4n) {
      res = res + toByteString('00000000')
    } else if (len(res) == 5n) {
      res = res + toByteString('000000')
    } else if (len(res) == 6n) {
      res = res + toByteString('0000')
    } else if (len(res) == 7n) {
      res = res + toByteString('00')
    }
    if (len(res) > 8n) {
      assert(false)
    }
    return res
  }

  @method()
  static getStateOutput(hash1: ByteString, hash2: ByteString): ByteString {
    // todo: optimize this function, because we use plain state data in deposit transaction, which is not hashed;
    // hash2 can be empty;
    // todo here maybe exist vulnerability when simply concatenate hash1 and hash2; but in poc, it's acceptable
    // todo: add tag to the state output
    // todo: change the state hash from sha256 to hash160 to save the size of the state output
    const hash = hash1 + hash2

    // opReturn data is max 80 bytes; 
    // https://github.com/bitcoin/bitcoin/blob/e606c577cb257d0927ca6ea939aab06cf0639aad/src/policy/policy.h#L79
    assert(len(hash) <= 80n)
    const scriptLen = len(hash) + 2n

    return (
      toByteString('0000000000000000') + // Output satoshis (0 sats)
      int2ByteString(scriptLen) + // Script lenght (34 bytes)
      OpCode.OP_RETURN +
      int2ByteString(len(hash)) + // Hash length (32 bytes)
      hash
    )
  }

  /**
   * Get the contract output.
   * output=satoshis[8 bytes] + spkLength[1 byte] + spk[34 bytes]
   *
   * @param amt - The amount of the output.
   * @param spk - The script pubkey of the output.
   * @returns The contract output.
   */
  @method()
  static getContractOutput(amt: bigint, spk: ByteString): ByteString {
    assert(len(spk) == 34n) // spk is 34(0x22) bytes long, p2tr address
    return GeneralUtils.padAmt(amt) + toByteString('22') + spk
  }
}
