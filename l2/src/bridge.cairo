use starknet::ContractAddress;

// TODO: Add the correct type for L1Address
type L1Address = u256;

#[starknet::interface]
pub trait IBridge<TContractState> {
    fn deposit(ref self: TContractState, recipient: ContractAddress, amount: u256);
    fn withdraw(ref self: TContractState, recipient: L1Address, amount: u256);
    fn close_batch(ref self: TContractState);
}

#[starknet::contract]
pub mod Bridge {
    use core::num::traits::zero::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use starknet::storage::VecTrait;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use crate::utils::hash::{Digest, DigestTrait};
    use super::L1Address;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Vec, MutableVecTrait,
    };
    use crate::btc::{IBTCDispatcher, IBTCDispatcherTrait};
    use crate::utils::{
        double_sha256::{double_sha256_digests, double_sha256_word_array},
        word_array::{WordArray, WordArrayTrait},
    };

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // External
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;

    // Internal
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // Branch of a merkle tree of withdrawal requests. Uses algo described here:
    // https://github.com/ethereum/research/blob/a4a600f2869feed5bfaab24b13ca1692069ef312/beacon_chain_impl/progressive_merkle_tree.py
    // https://www.youtube.com/watch?v=nZ8cquX5kew&ab_channel=FormalMethodsEurope
    #[phantom]
    #[starknet::storage_node]
    struct WithdrawalsBatch {
        branch: Vec<Digest>,
        size: u16,
        id: u128,
    }

    #[storage]
    struct Storage {
        btc: IBTCDispatcher,
        batch: WithdrawalsBatch,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositEvent {
        recipient: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct WithdrawEvent {
        recipient: L1Address,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct CloseBatchEvent {
        id: u128,
        root: Digest,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        DepositEvent: DepositEvent,
        WithdrawEvent: WithdrawEvent,
        CloseBatchEvent: CloseBatchEvent,
    }

    #[constructor]
    fn constructor(ref self: ContractState, btc_address: ContractAddress, owner: ContractAddress) {
        self.btc.write(IBTCDispatcher { contract_address: btc_address });
        self.batch.id.write(0);
        self.batch.size.write(0);
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl Bridge of super::IBridge<ContractState> {
        fn deposit(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.ownable.assert_only_owner();
            self.btc.read().mint(recipient, amount);

            self.emit(DepositEvent { recipient, amount });
        }

        fn withdraw(ref self: ContractState, recipient: L1Address, amount: u256) {
            let caller = get_caller_address();
            self.btc.read().burn(caller, amount);

            self.append(HelpersTrait::double_sha256_withdrawal(recipient, amount));

            self.emit(WithdrawEvent { recipient, amount });
        }

        fn close_batch(ref self: ContractState) {
            let root = self.root();
            let id = self.batch.id.read();

            self.batch.id.write(id + 1);
            self.batch.size.write(0);

            self.emit(CloseBatchEvent { id, root });
        }
    }

    #[generate_trait]
    pub impl HelpersImpl of HelpersTrait {
        fn double_sha256_withdrawal(recipient: L1Address, amount: u256) -> Digest {
            let mut b: WordArray = Default::default();

            let recipient: u256 = recipient.into();
            let recipient: Digest = recipient.into();
            b.append_span(recipient.value.span());

            let amount: Digest = amount.into();
            b.append_span(amount.value.span());

            double_sha256_word_array(b)
        }
    }

    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
         const TREE_HEIGHT: u8 = 10;
         const TREE_MAX_SIZE: u16 = 1024; //pow2(TREE_HEIGHT)!

        // TODO: how to enforce ZERO_HASHES.len() == TREE_HEIGHT?
        // calculated with print_zero_hashes below
        #[cairofmt::skip]
        const ZERO_HASHES: [[u32; 8]; 10] = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [3807779903, 1909579517, 1068079583, 2741588853, 1550386825, 2040095412, 2347489334, 2538507513],
            [2099567403, 4198582091, 4214196093, 1754246239, 2858291362, 2156722654, 812871865, 861070664],
            [2491776318, 143757168, 962433542, 1091551145, 1123133577, 2858072088, 2395159599, 1847623111],
            [431952387, 3552528441, 1013566501, 1502155963, 2651664431, 910006309, 3684743675, 2510070587],
            [2911086469, 1887493546, 3378700630, 3912122119, 3565730943, 113941511, 247519979, 1936780936],
            [4149171068, 670075167, 4270418929, 385287363, 953086358, 3888476695, 4151032589, 3608278989],
            [1723082150, 3777628280, 2788800972, 2132291431, 4168203796, 2521771669, 2723785127, 1542325057],
            [1829197597, 3996005857, 931906618, 2383644882, 4277580546, 482972235, 2287817650, 3459845800],
            [2257188826, 1732868934, 4244326882, 39139633, 3210730636, 2509762326, 1485744241, 392942686],
        ];

        fn get_element(self: @ContractState, i: u64) -> Digest {
            match self.batch.branch.get(i) {
                Option::Some(element) => element.read(),
                Option::None => {
                    panic!("should not happen!");
                    Zero::zero()
                },
            }
        }

        fn write_element(ref self: ContractState, i: u64, value: Digest) {
            if i >= self.batch.branch.len() {
                self.batch.branch.append().write(value);
            } else {
                self.batch.branch.at(i).write(value);
            }
        }

        fn append(ref self: ContractState, withdrawal: Digest) {
            //TODO: make sure it is not full
            let mut value = withdrawal;
            let original_size = self.batch.size.read();
            let mut size = original_size;
            let mut i = 0;

            while size % 2 == 1 {
                value = double_sha256_digests(@self.get_element(i), @value);
                size = size / 2;
                i += 1;
            };

            self.write_element(i, value);

            self.batch.size.write(original_size + 1);
        }

        fn root(self: @ContractState) -> Digest {
            let zero_hashes = Self::ZERO_HASHES.span();

            let mut root = DigestTrait::new(*zero_hashes.at(0));
            let mut height = 0;
            let mut size = self.batch.size.read();

            if size == Self::TREE_MAX_SIZE {
                return self.get_element(Self::TREE_HEIGHT.into());
            }

            while height < Self::TREE_HEIGHT.into() {
                if size % 2 == 1 {
                    root = double_sha256_digests(@self.get_element(height.into()), @root);
                } else {
                    root = double_sha256_digests(@root, @DigestTrait::new(*zero_hashes.at(height)));
                }
                size = size / 2;
                height += 1;
            };

            root
        }
    }
}

#[cfg(test)]
mod merkle_tree_tests {
    use crate::utils::hash::{Digest, DigestTrait};
    use crate::utils::double_sha256::double_sha256_digests;
    use super::Bridge;
    use super::Bridge::{InternalTrait, InternalImpl};

    fn merkle_root(hashes: Span<Digest>) -> Digest {
        let zero_hash = DigestTrait::new([0; 8]);
        let mut hashes: Array<Digest> = hashes.into();

        let expected_size = InternalImpl::TREE_MAX_SIZE;
        for _ in 0..(expected_size.into() - hashes.len()) {
            hashes.append(zero_hash);
        };

        let mut hashes = hashes.span();

        for _ in 0..InternalImpl::TREE_HEIGHT {
            let mut next_hashes: Array<Digest> = array![];
            while let Option::Some(v) = hashes.multi_pop_front::<2>() {
                let [a, b] = (*v).unbox();
                next_hashes.append(double_sha256_digests(@a, @b));
            };
            hashes = next_hashes.span();
        };

        *hashes.at(0)
    }

    // use this to fill the ZERO_HASHES array
    #[test]
    #[ignore]
    fn print_zero_hashes() {
        let mut previous: Digest = 0_u256.into();
        for _ in 0..InternalImpl::TREE_HEIGHT {
            previous = double_sha256_digests(@previous, @previous);
        }
    }

    fn data(size: u256) -> Array<Digest> {
        let x = 0x8000000000000000000000000000000000000000000000000000000000000000;
        let mut r = array![];
        for i in 1..size + 1 {
            r.append((x + i).into());
        };
        r
    }

    fn test_data(size: u256) {
        let data = data(size).span();

        let mut bridge = Bridge::contract_state_for_testing();

        for d in data {
            bridge.append(*d);
        };

        assert_eq!(bridge.root(), merkle_root(data), "merkle root mismatch");
    }

    #[test]
    fn test_merkle_root1() {
        test_data(1);
    }

    #[test]
    fn test_merkle_root2() {
        test_data(2);
    }

    #[test]
    fn test_merkle_root3() {
        test_data(3);
    }

    #[test]
    fn test_merkle_root256() {
        test_data(256);
    }

    #[test]
    fn test_merkle_root1023() {
        test_data(1023);
    }

    #[test]
    fn test_merkle_root1024() {
        test_data(1024);
    }
}

#[cfg(test)]
mod bridge_tests {
    use snforge_std::{
        declare, start_cheat_caller_address_global, stop_cheat_caller_address_global,
        cheat_caller_address, ContractClassTrait, DeclareResultTrait, CheatSpan,
    };
    use starknet::{ContractAddress, contract_address_const};
    use crate::btc::{IBTCDispatcher, IBTCDispatcherTrait};
    use super::{IBridgeDispatcher, IBridgeDispatcherTrait};
    use openzeppelin_access::ownable::interface::{IOwnableDispatcher, IOwnableDispatcherTrait};

    fn fixture() -> (
        ContractAddress,
        ContractAddress,
        ContractAddress,
        ContractAddress,
        IBTCDispatcher,
        IBridgeDispatcher,
    ) {
        let admin_address = contract_address_const::<0x1>();
        let alice_address = contract_address_const::<0x2>();
        let bob_address = contract_address_const::<0x3>();
        let carol_address = contract_address_const::<0x4>();

        let btc_class = declare("BTC").unwrap().contract_class();
        let bridge_class = declare("Bridge").unwrap().contract_class();

        let mut calldata = array![];
        admin_address.serialize(ref calldata);
        let (btc_address, _) = btc_class.deploy(@calldata).unwrap();

        let mut calldata = array![];
        btc_address.serialize(ref calldata);
        admin_address.serialize(ref calldata);
        let (bridge_address, _) = bridge_class.deploy(@calldata).unwrap();

        start_cheat_caller_address_global(admin_address);

        let btc = IOwnableDispatcher { contract_address: btc_address };
        btc.transfer_ownership(bridge_address);

        stop_cheat_caller_address_global();

        (
            admin_address,
            alice_address,
            bob_address,
            carol_address,
            IBTCDispatcher { contract_address: btc_address },
            IBridgeDispatcher { contract_address: bridge_address },
        )
    }

    #[test]
    fn test_deposit() { // let Bridge_class = declare("Bridge").unwrap().contract_class();
        let (admin_address, alice_address, bob_address, carol_address, btc, bridge) = fixture();

        cheat_caller_address(bridge.contract_address, admin_address, CheatSpan::TargetCalls(1));
        bridge.deposit(alice_address, 100);

        start_cheat_caller_address_global(alice_address);
        btc.transfer(bob_address, 50);
        btc.transfer(carol_address, 50);

        start_cheat_caller_address_global(bob_address);
        btc.approve(bridge.contract_address, 50);
        bridge.withdraw(808_u256, 50);

        start_cheat_caller_address_global(carol_address);
        btc.approve(bridge.contract_address, 50);
        bridge.withdraw(808_u256, 50);

        cheat_caller_address(bridge.contract_address, admin_address, CheatSpan::TargetCalls(1));
        bridge.close_batch();
    }

}