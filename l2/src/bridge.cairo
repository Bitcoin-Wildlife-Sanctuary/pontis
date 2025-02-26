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
    fn withdraw(ref self: TContractState, recipient: L1Address, amount: u32);
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


    #[derive(Copy, Drop, Debug, starknet::Store)]
    pub struct WithdrawalsTreeNode {
        pub hash: Digest,
        pub amount: u32,
    }

    // Branch of a merkle tree of withdrawal requests. Uses algo described here:
    // https://github.com/ethereum/research/blob/a4a600f2869feed5bfaab24b13ca1692069ef312/beacon_chain_impl/progressive_merkle_tree.py
    // https://www.youtube.com/watch?v=nZ8cquX5kew&ab_channel=FormalMethodsEurope
    #[phantom]
    #[starknet::storage_node]
    struct WithdrawalsBatch {
        branch: Vec<WithdrawalsTreeNode>,
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
        pub total: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawEvent {
        pub id: u128,
        pub recipient: L1Address,
        pub amount: u32,
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
                leafs.append(DepositHelpersTrait::hash256_deposit(*recipient, *amount));
            };

            let root = DepositHelpersTrait::merkle_root(leafs.span());
            let btc = self.btc.read();
            let mut total = 0_u32;
            let mut deposits_ = deposits;
            while let Option::Some(d) = deposits_.pop_front() {
                let amount: u32 = (*d.amount).into();
                btc.mint(*d.recipient, amount.into());
                total = total + amount;
            };

            let id = double_sha256_parent(@txid, @root);

            self.emit(DepositEvent { id, total });
        }

        fn withdraw(ref self: ContractState, recipient: L1Address, amount: u32) {
            let caller = get_caller_address();

            self.btc.read().burn(caller, amount.into());

            self.append(ProgresiveHelpersTrait::hash256_withdrawal(recipient, amount));

            self.emit(WithdrawEvent { id: self.batch.id.read(), recipient, amount });
        }

        fn close_withdrawal_batch(ref self: ContractState, id: u128) {
            self.ownable.assert_only_owner();

            self.close_batch_internal(id);
        }
    }

    #[generate_trait]
    pub impl DepositHelpersImpl of DepositHelpersTrait {
        fn hash256_deposit(recipient: ContractAddress, amount: u32) -> Digest {
            let mut b: WordArray = Default::default();

            let recipient: felt252 = recipient.into();
            let recipient: u256 = recipient.into();
            let recipient: Digest = recipient.into();

            b.append_span(recipient.value.span());
            b.append_bytes(amount.into(), 4);

            double_sha256_word_array(b)
        }

        fn hash256_inner_nodes(level: u8, a: @Digest, b: @Digest) -> Digest {
            let mut input: WordArray = Default::default();
            input.append_u8(level);
            input.append_span(a.value.span());
            input.append_span(b.value.span());

            double_sha256_word_array(input)
        }

        fn merkle_root(hashes: Span<Digest>) -> Digest {
            let mut hashes = hashes;

            let mut level: u8 = 1;

            while hashes.len() > 1 {
                let mut next_hashes: Array<Digest> = array![];
                while let Option::Some(v) = hashes.multi_pop_front::<2>() {
                    let [a, b] = (*v).unbox();
                    next_hashes.append(Self::hash256_inner_nodes(level, @a, @b));
                };
                assert!(hashes.len() == 0, "Number of hashes should be a power of 2");
                hashes = next_hashes.span();
                level += 1;
            };

            *hashes.at(0)
        }
    }

    #[generate_trait]
    pub impl ProgresiveDepositHelpersImpl of ProgresiveHelpersTrait {
        const TREE_HEIGHT: u8 = 8;
        const TREE_MAX_SIZE: u16 = 16; //pow2(TREE_HEIGHT)!
        // TODO: how to enforce ZERO_HASHES.len() == TREE_HEIGHT?
        // calculated with print_zero_hashes below
        #[cairofmt::skip]
        const ZERO_HASHES: [[u32; 8]; 8] = [
            [2360934693, 398989310, 2909078151, 3592150428, 1753234283, 4190519603, 3702210149, 3047492793],
            [2184362320, 432503059, 1724234310, 567490483, 1050108742, 4271099403, 3742527856, 3302940544],
            [1879265113, 1540735599, 585668410, 358575924, 2435338388, 117911002, 417806259, 617113548],
            [2077920177, 2809277470, 3243505368, 1950208205, 2722065081, 864545533, 468673240, 215629236],
            [394238821, 3728830357, 3427370926, 914184081, 1793518583, 4210030031, 3879276231, 3409966346],
            [2026343462, 931643422, 2956465880, 2959742596, 3083393749, 1931568333, 1654112884, 3652093134],
            [3433841257, 436157381, 278228785, 3714401486, 3044545020, 3281646087, 3139343623, 3473843373],
            [651600968, 3099546193, 2356314180, 511403259, 2588112061, 2742955426, 1134377328, 138145314]
        ];

        fn get_element(self: @ContractState, i: u64) -> WithdrawalsTreeNode {
            match self.batch.branch.get(i) {
                Option::Some(element) => element.read(),
                Option::None => {
                    panic!("should not happen!");
                    WithdrawalsTreeNode { hash: Zero::zero(), amount: 0 }
                },
            }
        }

        fn write_element(ref self: ContractState, i: u64, value: WithdrawalsTreeNode) {
            if i >= self.batch.branch.len() {
                self.batch.branch.append().write(value);
            } else {
                self.batch.branch.at(i).write(value);
            }
        }

        fn is_full(self: @ContractState) -> bool {
            self.batch.size.read() == Self::TREE_MAX_SIZE
        }

        fn hash256_withdrawal(recipient: L1Address, amount: u32) -> WithdrawalsTreeNode {
            let mut b: WordArray = recipient.into();
            b.append_word(amount, 4);

            let hash = double_sha256_word_array(b);

            WithdrawalsTreeNode { hash, amount }
        }

        fn hash256_inner_nodes(
            left: @WithdrawalsTreeNode, right: @WithdrawalsTreeNode,
        ) -> WithdrawalsTreeNode {
            let mut b: WordArray = Default::default();

            b.append_word(*left.amount, 4);
            b.append_span(left.hash.value.span());

            b.append_word(*right.amount, 4);
            b.append_span(right.hash.value.span());

            let hash = double_sha256_word_array(b);

            let amount = *left.amount + *right.amount;
            WithdrawalsTreeNode { hash, amount }
        }

        fn empty_node(level: u32) -> WithdrawalsTreeNode {
            WithdrawalsTreeNode {
                hash: DigestTrait::new(*Self::ZERO_HASHES.span().at(level)), amount: 0,
            }
        }

        fn merkle_root(hashes: Span<WithdrawalsTreeNode>) -> Digest {
            let mut hashes = hashes;

            while hashes.len() > 1 {
                let mut next_hashes: Array<WithdrawalsTreeNode> = array![];
                while let Option::Some(v) = hashes.multi_pop_front::<2>() {
                    let [a, b] = (*v).unbox();
                    next_hashes.append(Self::hash256_inner_nodes(@a, @b));
                };
                assert!(hashes.len() == 0, "Number of hashes should be a power of 2");
                hashes = next_hashes.span();
            };

            *hashes.at(0).hash
        }


        fn append(ref self: ContractState, withdrawal: WithdrawalsTreeNode) {
            let original_size = self.batch.size.read();

            if original_size == Self::TREE_MAX_SIZE {
                self.close_batch_internal(self.batch.id.read());
            }

            let mut value = withdrawal;
            let mut size = original_size;
            let mut i = 0;

            while size % 2 == 1 {
                value = Self::hash256_inner_nodes(@self.get_element(i), @value);
                size = size / 2;
                i += 1;
            };

            self.write_element(i, value);

            self.batch.size.write(original_size + 1);
        }

        fn root(self: @ContractState) -> Digest {
            let mut root = Self::empty_node(0);
            let mut height = 0_u32;
            let mut size = self.batch.size.read();

            // round up to the nearest power of 2
            let mut rounded_size = 1_u16;
            let mut rounded_height = 0_u32;
            while (rounded_size < size) {
                rounded_size *= 2;
                rounded_height += 1;
            };

            if size == rounded_size {
                return self.get_element(rounded_height.into()).hash;
            }

            while height < rounded_height {
                if size % 2 == 1 {
                    root = Self::hash256_inner_nodes(@self.get_element(height.into()), @root);
                } else {
                    root = Self::hash256_inner_nodes(@root, @Self::empty_node(height));
                }
                size = size / 2;
                height += 1;
            };

            root.hash
        }

        fn close_batch_internal(ref self: ContractState, requested_id: u128) {
            let id = self.batch.id.read();

            assert!(id >= requested_id, "Wrong batch id requested");

            if (id != requested_id) {
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
    use super::Bridge::DepositHelpersImpl;

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
        assert_eq!(DepositHelpersImpl::merkle_root(data), *data.at(0), "merkle root mismatch");
    }

    #[test]
    #[should_panic(expected: "Number of hashes should be a power of 2")]
    fn test_merkle_root3() {
        DepositHelpersImpl::merkle_root(data(3).span());
    }

    #[test]
    #[should_panic(expected: "Number of hashes should be a power of 2")]
    fn test_merkle_root7() {
        DepositHelpersImpl::merkle_root(data(7).span());
    }

    #[test]
    fn test_merkle_root() {
        DepositHelpersImpl::merkle_root(data(1).span());
        DepositHelpersImpl::merkle_root(data(2).span());
        DepositHelpersImpl::merkle_root(data(4).span());
        DepositHelpersImpl::merkle_root(data(8).span());
        DepositHelpersImpl::merkle_root(data(16).span());
    }
}

#[cfg(test)]
mod withdrawals_tests {
    use super::Bridge;
    use super::Bridge::{
        ProgresiveHelpersTrait, ProgresiveDepositHelpersImpl, DepositHelpersImpl,
        WithdrawalsTreeNode,
    };

    // use this to fill the ZERO_HASHES array
    #[test]
    #[ignore]
    fn print_zero_hashes() {
        let mut previous = ProgresiveHelpersTrait::hash256_withdrawal(Default::default(), 0);
        println!("{:?}: {:?}", 0, previous.hash);
        for i in 1..ProgresiveDepositHelpersImpl::TREE_HEIGHT {
            previous = ProgresiveHelpersTrait::hash256_inner_nodes(@previous, @previous);
            println!("{:?}: {:?}", i, previous.hash);
        }
    }

    fn data(size: u32) -> Array<WithdrawalsTreeNode> {
        let mut r = array![];
        for i in 1..size + 1 {
            r.append(ProgresiveHelpersTrait::hash256_withdrawal(Default::default(), i));
        };
        r
    }

    fn complement_with_zeros(data: Span<WithdrawalsTreeNode>) -> Span<WithdrawalsTreeNode> {
        let mut required_size = 1;
        while (required_size < data.len()) {
            required_size *= 2;
        };

        let mut r = array![];
        r.append_span(data);

        let mut missing_zeros = required_size - data.len();

        for _ in 0..missing_zeros {
            r.append(ProgresiveHelpersTrait::empty_node(0));
        };
        r.span()
    }

    fn test_data(size: u32) {
        let data = data(size).span();

        let mut bridge = Bridge::contract_state_for_testing();

        for d in data {
            bridge.append(*d);
        };

        assert_eq!(
            bridge.root(),
            ProgresiveHelpersTrait::merkle_root(complement_with_zeros(data)),
            "merkle root mismatch",
        );

        bridge.close_batch_for_testing();
    }

    #[test]
    fn test_progressive_merkle_root1() {
        for i in 1..32_u32 {
            test_data(i);
        }
    }

    #[test]
    fn test_progressive_merkle_root2() {
        for i in 33..48_u32 {
            test_data(i);
        }
    }

    #[test]
    fn test_progressive_merkle_root3() {
        for i in 49..64_u32 {
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
        Deposit, Bridge::{Event, CloseBatchEvent, ProgresiveDepositHelpersImpl}, IBridgeDispatcher,
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
        for _ in 0..ProgresiveDepositHelpersImpl::TREE_MAX_SIZE + 1 {
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
                                root: 84792998160067379875286462401390359032051381270615771028281096759204008635079_u256
                                    .into(),
                            },
                        ),
                    ),
                ],
            );
    }
}
