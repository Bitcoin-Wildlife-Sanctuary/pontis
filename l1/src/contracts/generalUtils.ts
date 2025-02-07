import {
  SmartContractLib,
  method,
  ByteString,
  int2ByteString,
  toByteString,
  assert,
  prop,
  Sha256,
  len,
  OpCode,
  Addr,
  sha256,
} from 'scrypt-ts'

export class GeneralUtils extends SmartContractLib {
  @prop()
  static readonly NULL_ADDRESS: Addr = Addr(
    toByteString('0000000000000000000000000000000000000000')
  )

  @method()
  static padAmt(amt: bigint): ByteString {
    // note: here only allow max 21.47483647 BTC, otherwise it thows. the reason is bitcoin vm only support int32 math
    // todo: add support for more than 21.47483647 BTC
    
    // check the amt is less or equal than int32.max, avoid overflow
    assert(amt <= 0x7fffffff);
    // const res = int2ByteString(amt, 8n)
    let res = int2ByteString(amt)
    if (res == toByteString('')) {
      res = toByteString('0000000000000000')
    } else if (amt < 0x0100n) {
      res += toByteString('00000000000000')
    } else if (amt < 0x010000n) {
      res += toByteString('000000000000')
    } else if (amt < 0x01000000n) {
      res += toByteString('0000000000')
    } else if (amt <= 0x7fffffffn) {
      res += toByteString('00000000')
    } else {
      assert(false)
    }
    return res
  }

  @method()
  static getStateOutput(hash1: ByteString, hash2: ByteString): ByteString {
    // hash2 can be empty;
    // todo here maybe exist vulnerability when simply concatenate hash1 and hash2; but in poc, it's acceptable
    assert(len(hash1) == 32n);
    assert(len(hash2) == 32n || len(hash2) == 0n);
    const hash = hash1 + hash2;
    const scriptLen = len(hash) + 2n;

    return (
      toByteString('0000000000000000') + // Output satoshis (0 sats)
      int2ByteString(scriptLen) + // Script lenght (34 bytes)
      OpCode.OP_RETURN +
      int2ByteString(len(hash)) + // Hash length (32 bytes)
      hash
    )
  }

  @method()
  static getContractOutput(amt: bigint, spk: ByteString): ByteString {
    assert(len(spk) == 34n) // spk is 34(0x22) bytes long
    return GeneralUtils.padAmt(amt) + toByteString('22') + spk
  }
}
