use starknet::ContractAddress;
use crate::utils::hash::Digest;
use crate::utils::word_array::WordSpan;

type L1Address = WordSpan;

#[derive(Drop, Serde)]
struct Deposit {
    recipient: ContractAddress,
    amount: u32,
}

#[starknet::interface]
pub trait IBridge<TContractState> {
    fn deposit(ref self: TContractState, txid: Digest, deposits: Span<Deposit>);
    fn withdraw(ref self: TContractState, recipient: L1Address, amount: u256);
    fn close_withdrawal_batch(ref self: TContractState, id: u128);
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
    use super::Deposit;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Vec, MutableVecTrait,
    };
    use crate::btc::{IBTCDispatcher, IBTCDispatcherTrait};
    use crate::utils::{
        double_sha256::{double_sha256_parent, double_sha256_word_array},
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
    pub struct DepositEvent {
        pub id: Digest,
        pub total: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawEvent {
        pub id: u128,
        pub recipient: L1Address,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CloseBatchEvent {
        pub id: u128,
        pub root: Digest,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
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
    impl BridgeImpl of super::IBridge<ContractState> {
        // limits: max tx size 10M steps, number of events 1K, calldata 4K felts
        fn deposit(ref self: ContractState, txid: Digest, deposits: Span<Deposit>) {
            self.ownable.assert_only_owner();

            let mut deposits_ = deposits;
            let mut leafs: Array<Digest> = array![];
            while let Option::Some(Deposit { recipient, amount }) = deposits_.pop_front() {
                leafs.append(HelpersTrait::hash256_deposit(*recipient, *amount));
            };

            let root = HelpersTrait::merkle_root_with_levels(leafs.span());
            let btc = self.btc.read();
            let mut total = 0_u256;
            let mut deposits_ = deposits;
            while let Option::Some(d) = deposits_.pop_front() {
                let amount_u256: u256 = (*d.amount).into();
                btc.mint(*d.recipient, amount_u256);
                total = total + amount_u256;
            };

            let id = double_sha256_parent(@txid, @root);

            self.emit(DepositEvent { id, total });
        }

        fn withdraw(ref self: ContractState, recipient: L1Address, amount: u256) {
            let caller = get_caller_address();

            self.btc.read().burn(caller, amount);

            self.append(HelpersTrait::double_sha256_withdrawal(recipient, amount));

            self.emit(WithdrawEvent { id: self.batch.id.read(), recipient, amount });
        }

        fn close_withdrawal_batch(ref self: ContractState, id: u128) {
            self.ownable.assert_only_owner();

            self.close_batch_internal(id);
        }
    }

    #[generate_trait]
    pub impl HelpersImpl of HelpersTrait {
        fn hash256_deposit(recipient: ContractAddress, amount: u32) -> Digest {
            let mut b: WordArray = Default::default();

            let recipient: felt252 = recipient.into();
            let recipient: u256 = recipient.into();
            let recipient: Digest = recipient.into();

            b.append_span(recipient.value.span());
            b.append_bytes(amount.into(), 4);

            double_sha256_word_array(b)
        }

        fn hash256_inner_deposit_node(level: u8, a: @Digest, b: @Digest) -> Digest {
            let mut input: WordArray = Default::default();
            input.append_u8(level);
            input.append_span(a.value.span());
            input.append_span(b.value.span());

            double_sha256_word_array(input)
        }

        fn double_sha256_withdrawal(recipient: L1Address, amount: u256) -> Digest {
            let mut b: WordArray = recipient.into();

            let amount: Digest = amount.into();
            b.append_span(amount.value.span());

            double_sha256_word_array(b)
        }

        fn merkle_root(hashes: Span<Digest>) -> Digest {
            let mut hashes = hashes;

            while hashes.len() > 1 {
                let mut next_hashes: Array<Digest> = array![];
                while let Option::Some(v) = hashes.multi_pop_front::<2>() {
                    let [a, b] = (*v).unbox();
                    next_hashes.append(double_sha256_parent(@a, @b));
                };
                assert!(hashes.len() == 0, "Number of hashes should be a power of 2");
                hashes = next_hashes.span();
            };

            *hashes.at(0)
        }
        fn merkle_root_with_levels(hashes: Span<Digest>) -> Digest {
            let mut hashes = hashes;

            let mut level: u8 = 1;

            while hashes.len() > 1 {
                let mut next_hashes: Array<Digest> = array![];
                while let Option::Some(v) = hashes.multi_pop_front::<2>() {
                    let [a, b] = (*v).unbox();
                    next_hashes.append(Self::hash256_inner_deposit_node(level, @a, @b));
                };
                assert!(hashes.len() == 0, "Number of hashes should be a power of 2");
                hashes = next_hashes.span();
                level += 1;
            };

            *hashes.at(0)
        }
    }

    #[generate_trait]
    pub impl ProgresiveHelpersImpl of ProgresiveHelpersTrait {
        const TREE_HEIGHT: u8 = 4;
        const TREE_MAX_SIZE: u16 = 16; //pow2(TREE_HEIGHT)!
        // TODO: how to enforce ZERO_HASHES.len() == TREE_HEIGHT?
        // calculated with print_zero_hashes below
        #[cairofmt::skip]
        const ZERO_HASHES: [[u32; 8]; 8] = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [3807779903, 1909579517, 1068079583, 2741588853, 1550386825, 2040095412, 2347489334, 2538507513],
            [2099567403, 4198582091, 4214196093, 1754246239, 2858291362, 2156722654, 812871865, 861070664],
            [2491776318, 143757168, 962433542, 1091551145, 1123133577, 2858072088, 2395159599, 1847623111],
            [431952387, 3552528441, 1013566501, 1502155963, 2651664431, 910006309, 3684743675, 2510070587],
            [2911086469, 1887493546, 3378700630, 3912122119, 3565730943, 113941511, 247519979, 1936780936],
            [4149171068, 670075167, 4270418929, 385287363, 953086358, 3888476695, 4151032589, 3608278989],
            [1723082150, 3777628280, 2788800972, 2132291431, 4168203796, 2521771669, 2723785127, 1542325057],
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

        fn is_full(self: @ContractState) -> bool {
            self.batch.size.read() == Self::TREE_MAX_SIZE
        }

        fn append(ref self: ContractState, withdrawal: Digest) {
            let original_size = self.batch.size.read();

            if original_size == Self::TREE_MAX_SIZE {
                self.close_batch_internal(self.batch.id.read());
            }

            let mut value = withdrawal;
            let mut size = original_size;
            let mut i = 0;

            while size % 2 == 1 {
                value = double_sha256_parent(@self.get_element(i), @value);
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

            // round up to the nearest power of 2
            let mut rounded_size = 1;
            let mut rounded_height = 0;
            while (rounded_size < size) {
                rounded_size *= 2;
                rounded_height += 1;
            };

            if size == rounded_size {
                return self.get_element(rounded_height.into());
            }

            while height < rounded_height {
                if size % 2 == 1 {
                    root = double_sha256_parent(@self.get_element(height.into()), @root);
                } else {
                    root = double_sha256_parent(@root, @DigestTrait::new(*zero_hashes.at(height)));
                }
                size = size / 2;
                height += 1;
            };

            root
        }

        fn close_batch_internal(ref self: ContractState, requested_id: u128) {

            let id = self.batch.id.read();

            assert!(id >= requested_id, "Wrong batch id requested");

            if(id != requested_id) {
                return;
            }

            let root = self.root();
            
            self.batch.id.write(id + 1);
            self.batch.size.write(0);

            self.emit(CloseBatchEvent { id, root });
        }

        fn close_batch_for_testing(ref self: ContractState) {
            self.close_batch_internal(self.batch.id.read());
        }
    }
}

#[cfg(test)]
mod merkle_tree_tests {
    use crate::utils::hash::Digest;
    use super::Bridge::HelpersImpl;
    // use super::Bridge::MerkleTreeHelpersImpl::merkle_root;
    // use super::Bridge::HelpersTrait::merkle_root;

    fn data(size: u256) -> Array<Digest> {
        let x = 0x8000000000000000000000000000000000000000000000000000000000000000;
        let mut r = array![];
        for i in 1..size + 1 {
            r.append((x + i).into());
        };
        r
    }

    #[test]
    fn test_merkle_root1() {
        let data = data(1).span();
        assert_eq!(HelpersImpl::merkle_root(data), *data.at(0), "merkle root mismatch");
    }

    #[test]
    #[should_panic(expected: "Number of hashes should be a power of 2")]
    fn test_merkle_root3() {
        HelpersImpl::merkle_root(data(3).span());
    }

    #[test]
    #[should_panic(expected: "Number of hashes should be a power of 2")]
    fn test_merkle_root7() {
        HelpersImpl::merkle_root(data(7).span());
    }

    #[test]
    fn test_merkle_root() {
        HelpersImpl::merkle_root(data(1).span());
        HelpersImpl::merkle_root(data(2).span());
        HelpersImpl::merkle_root(data(4).span());
        HelpersImpl::merkle_root(data(8).span());
        HelpersImpl::merkle_root(data(16).span());
    }
}

#[cfg(test)]
mod withdrawals_tests {
    use crate::utils::hash::Digest;
    use crate::utils::double_sha256::double_sha256_parent;
    use super::Bridge;
    use super::Bridge::{ProgresiveHelpersTrait, ProgresiveHelpersImpl, HelpersImpl};

    // use this to fill the ZERO_HASHES array
    #[test]
    #[ignore]
    fn print_zero_hashes() {
        let mut previous: Digest = 0_u256.into();
        for _ in 0..ProgresiveHelpersImpl::TREE_HEIGHT {
            previous = double_sha256_parent(@previous, @previous);
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

    fn complement_with_zeros(data: Span<Digest>) -> Span<Digest> {
        let mut required_size = 1;
        while (required_size < data.len()) {
            required_size *= 2;
        };

        let mut r = array![];
        r.append_span(data);

        let mut missing_zeros = required_size - data.len();

        for _ in 0..missing_zeros {
            r.append(0_u256.into());
        };
        r.span()
    }

    fn test_data(size: u256) {
        let data = data(size).span();

        let mut bridge = Bridge::contract_state_for_testing();

        for d in data {
            bridge.append(*d);
        };

        assert_eq!(
            bridge.root(),
            HelpersImpl::merkle_root(complement_with_zeros(data)),
            "merkle root mismatch",
        );

        bridge.close_batch_for_testing();
    }

    #[test]
    fn test_progressive_merkle_root1() {
        for i in 1..64_u256 {
            test_data(i);
        }
    }

    #[test]
    fn test_progressive_merkle_root2() {
        for i in 65..96_u256 {
            test_data(i);
        }
    }
}

#[cfg(test)]
mod bridge_tests {
    use snforge_std::{
        declare, spy_events, start_cheat_caller_address_global, stop_cheat_caller_address_global,
        cheat_caller_address, ContractClassTrait, DeclareResultTrait, CheatSpan,
        EventSpyAssertionsTrait,
    };

    use starknet::{ContractAddress, contract_address_const};
    use crate::btc::{IBTCDispatcher, IBTCDispatcherTrait};
    use super::{
        Deposit, Bridge::{Event, CloseBatchEvent, ProgresiveHelpersImpl}, IBridgeDispatcher,
        IBridgeDispatcherTrait,
    };

    use crate::utils::word_array::hex::words_from_hex;
    use crate::utils::word_array::WordArrayTrait;

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
    fn test_basic_flow() {
        let (admin_address, alice_address, bob_address, carol_address, btc, bridge) = fixture();

        cheat_caller_address(bridge.contract_address, admin_address, CheatSpan::TargetCalls(1));

        bridge
            .deposit(
                Default::default(),
                array![Deposit { recipient: alice_address, amount: 100 }].span(),
            );

        start_cheat_caller_address_global(alice_address);
        btc.transfer(bob_address, 50);
        btc.transfer(carol_address, 50);

        start_cheat_caller_address_global(bob_address);
        btc.approve(bridge.contract_address, 50);
        bridge.withdraw(words_from_hex("8080").span(), 50);

        start_cheat_caller_address_global(carol_address);
        btc.approve(bridge.contract_address, 50);
        bridge.withdraw(words_from_hex("8080").span(), 50);

        cheat_caller_address(bridge.contract_address, admin_address, CheatSpan::TargetCalls(1));
        bridge.close_withdrawal_batch(0);
    }

    #[test]
    fn test_auto_close_batch() {
        let (admin_address, alice_address, _, _, btc, bridge) = fixture();

        cheat_caller_address(bridge.contract_address, admin_address, CheatSpan::TargetCalls(1));
        bridge
            .deposit(
                Default::default(),
                array![Deposit { recipient: alice_address, amount: 2000 }].span(),
            );

        let mut spy = spy_events();

        start_cheat_caller_address_global(alice_address);
        btc.approve(bridge.contract_address, 2000);
        for _ in 0..ProgresiveHelpersImpl::TREE_MAX_SIZE + 1 {
            bridge.withdraw(words_from_hex("8080").span(), 1);
        };

        spy
            .assert_emitted(
                @array![
                    (
                        bridge.contract_address,
                        Event::CloseBatchEvent(
                            CloseBatchEvent {
                                id: 0,
                                root: 95311252102440718178582621104701739409720546408266107166172413683077514559281_u256
                                    .into(),
                            },
                        ),
                    ),
                ],
            );
    }
}
