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
    // note: here only allow max 21.47483647 BTC, otherwise it thows. the reason is bitcoin vm only support int32 math
    // todo: add support for more than 21.47483647 BTC
    
    // check the amt is less or equal than int32.max, avoid overflow
    assert(amt <= 0x7fffffff);
    const res = int2ByteString(amt, 8n)
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
    return GeneralUtils.padAmt(amt) + toByteString('22') + spk
  }
}
