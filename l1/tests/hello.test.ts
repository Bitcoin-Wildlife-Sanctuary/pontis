import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('Test Hello', () => {
    it('should always pass', () => {
        expect(true).to.be.true;
    });
});
