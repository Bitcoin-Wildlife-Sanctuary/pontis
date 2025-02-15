import { int2ByteString } from "scrypt-ts"
import { GeneralUtils } from "../../src/contracts/generalUtils"
import { expect } from "chai"


describe('util.test', () => {

    function testPadAmt(amt: bigint) {
        const res = GeneralUtils.padAmt(amt)
        const expected = int2ByteString(amt, 8n)
        expect(res).to.equal(expected, `padAmt(${amt}=${int2ByteString(amt)}) should be ${expected}`)
    }

    function getRandomAmt(start: bigint, end: bigint) {
        const random = Math.floor(Math.random() * (Number(end) - Number(start) + 1)) + Number(start)
        return BigInt(random)
    }

    function testRandomPadAmt(count: number, start: bigint, end: bigint) {
        for (let i = 0; i < count; i++) {
            const amt = getRandomAmt(start, end)
            testPadAmt(amt)
        }
    }


    describe('test for GeneralUtils.padAmt', () => {
        it('GeneralUtils.padAmt should work as expected', () => {

            testPadAmt(0n)
            testPadAmt(1n)
    
            testRandomPadAmt(1000, 0n, 0xffn)
    
            testPadAmt(0xffn - 2n)
            testPadAmt(0xffn - 1n)
            testPadAmt(0xffn)
            testPadAmt(0xffn + 1n)
            testPadAmt(0xffn + 2n)
    
            testRandomPadAmt(1000, 0xffn, 0xffffn)
    
            testPadAmt(0xffffn - 2n)
            testPadAmt(0xffffn - 1n)
            testPadAmt(0xffffn)
            testPadAmt(0xffffn + 1n)
            testPadAmt(0xffffn + 2n)
    
            testRandomPadAmt(1000, 0xffffn, 0x7fffffffn)
    
            testPadAmt(0x7fffffffn - 2n)
            testPadAmt(0x7fffffffn - 1n)
            testPadAmt(0x7fffffffn)
        })
        it('GeneralUtils.padAmt should throw when amt is too large', () => {
            testPadAmt(BigInt(0x7fffffff - 1))
            testPadAmt(BigInt(0x7fffffff))
            expect(() => GeneralUtils.padAmt(BigInt(0x7fffffff) + 1n)).to.throw()
        })
        it('GeneralUtils.padAmt should throw when amt is negative', () => {
            expect(() => GeneralUtils.padAmt(-1n)).to.throw()
        })
    })
})

