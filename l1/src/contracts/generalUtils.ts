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
} from 'scrypt-ts'

export class GeneralUtils extends SmartContractLib {
  @prop()
  static readonly NULL_ADDRESS: Addr = Addr(
    toByteString('0000000000000000000000000000000000000000')
  )

  @method()
  static padAmt(amt: bigint): ByteString {
    // todo: here only allow max 0.167 BTC, otherwise it thows
    // todo: add support for more than 0.167 BTC
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
  static getStateOutput(hash: Sha256): ByteString {
    return (
      toByteString('0000000000000000') + // Output satoshis (0 sats)
      toByteString('22') + // Script lenght (34 bytes)
      OpCode.OP_RETURN +
      toByteString('20') + // Hash length (32 bytes)
      hash
    )
  }

  @method()
  static getContractOutput(amt: bigint, spk: ByteString): ByteString {
    assert(len(spk) == 34n) // spk is 34(0x22) bytes long
    // todo: amt is uint64, which is not supported by bitcoin virtual machine
    return GeneralUtils.padAmt(amt) + toByteString('22') + spk
  }
}
