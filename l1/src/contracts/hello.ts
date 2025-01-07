import { assert, method, SmartContract } from 'scrypt-ts';

export class Hello extends SmartContract {
    constructor() {
        super(...arguments);
    }

    @method()
    public unlock() {
        assert(true);
    }
}
