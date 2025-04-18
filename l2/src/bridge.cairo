use starknet::ContractAddress;
use crate::utils::digest::Digest;
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
    fn pending_batch_id(self: @TContractState) -> u128;
}

#[starknet::contract]
pub mod Bridge {
    use core::num::traits::zero::Zero;
    use core::sha256::compute_sha256_u32_array;
    use openzeppelin_access::ownable::OwnableComponent;
    use starknet::storage::VecTrait;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use crate::utils::digest::{Digest, DigestTrait};
    use super::L1Address;
    use super::Deposit;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Vec, MutableVecTrait,
    };
    use crate::btc::{IBTCDispatcher, IBTCDispatcherTrait};
    use crate::utils::{word_array::{WordArray, WordArrayTrait}};


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

            let btc = self.btc.read();
            let mut total = 0_u32;
            let mut deposits_ = deposits;
            while let Option::Some(d) = deposits_.pop_front() {
                let amount: u32 = (*d.amount).into();
                btc.mint(*d.recipient, amount.into());
                total = total + amount;
            };

            let id = DepositHelpersTrait::get_deposit_id(txid, deposits);

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

        fn pending_batch_id(self: @ContractState) -> u128 {
            self.batch.id.read()
        }
    }

    #[generate_trait]
    pub impl DepositHelpersImpl of DepositHelpersTrait {
        fn get_deposit_id(txid: Digest, deposits: Span<Deposit>) -> Digest {
            let mut deposits = deposits;

            if deposits.len() == 1 {
                if let Option::Some(Deposit { recipient, amount }) = deposits.pop_front() {
                    let recipient: felt252 = (*recipient).into();
                    let recipient: u256 = recipient.into();

                    let mut w: WordArray = Default::default();
                    w.append_span(txid.value.span());
                    w.append_u256(recipient);
                    w.append_u64_le((*amount).into());

                    return w.compute_sha256();
                };
            }

            let mut leafs = array![];
            while let Option::Some(Deposit { recipient, amount }) = deposits.pop_front() {
                let recipient: felt252 = (*recipient).into();
                let recipient: u256 = recipient.into();

                let mut leaf: WordArray = Default::default();
                leaf.append_u256(recipient);
                leaf.append_u64_le((*amount).into());

                leafs.append(leaf.span());
            };

            let mut level: u8 = 1;

            let mut hashes = leafs.span();
            while hashes.len() > 1 {
                let mut next_hashes = array![];
                while let Option::Some(v) = hashes.multi_pop_front::<2>() {
                    let [a, b] = (*v).unbox();
                    let mut w: WordArray = Default::default();
                    w.append_u8(level);
                    w.append_word_span(a);
                    w.append_word_span(b);
                    let hash = w.compute_hash256();
                    let mut w: WordArray = Default::default();
                    w.append_digest(hash);
                    next_hashes.append(w.span());
                };
                assert!(hashes.len() == 0, "Number of hashes should be a power of 2");
                hashes = next_hashes.span();
                level += 1;
            };

            let (words, _, num_bytes) = (*hashes.at(0)).into().into_components();
            assert!(words.len() == 8 && num_bytes == 0, "hash should be 8 u32s");

            let mut w: WordArray = Default::default();
            w.append_span(txid.value.span());
            w.append_span(words.span());

            return w.compute_sha256();
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
            [2941612277, 2709588858, 4153192267, 3339347471, 234167874, 3136888141, 3853660813, 3773316604], 
            [4252268135, 3156982997, 1058175766, 3982171689, 2165452295, 1412192036, 676370435, 3246908486], 
            [118982229, 1164891333, 433494718, 2210494425, 989293199, 3757041399, 2351707735, 3044148480],
            [3132511574, 1535310176, 1940885095, 311013768, 3506796797, 1597562327, 1683926785, 2365022860],
            [3874630278, 1618857047, 2837960875, 3102865115, 2694842550, 3865935458, 2704783161, 2089796958],
            [1342209253, 336170425, 4130094296, 1198558124, 3471065097, 1609315156, 2623184362, 848957000],
            [3363877118, 1484151529, 2503273299, 680864377, 987407226, 2588493262, 3422490052, 169888085],
            [494208055, 180117351, 3987495022, 4240216843, 1810711745, 1677977769, 3712207368, 137579714],
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
            assert!(amount <= 0x7fffffff, "amount to big");

            let mut b: WordArray = recipient.into();
            b.append_u64_le(amount.into());
            let hash = b.compute_sha256();

            WithdrawalsTreeNode { hash, amount }
        }

        fn hash256_inner_nodes(
            left: @WithdrawalsTreeNode, right: @WithdrawalsTreeNode,
        ) -> WithdrawalsTreeNode {
            let mut b: WordArray = Default::default();

            b.append_u64_le((*left.amount).into());
            b.append_span(left.hash.value.span());

            b.append_u64_le((*right.amount).into());
            b.append_span(right.hash.value.span());

            let (input, last_input_word, last_input_num_bytes) = b.into().into_components();

            let hash = DigestTrait::new(
                compute_sha256_u32_array(input, last_input_word, last_input_num_bytes),
            );

            let amount = *left.amount + *right.amount;

            assert!(amount <= 0x7fffffff, "amount to big");

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
                let mut next_hashes = array![];
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
    use super::Bridge::DepositHelpersImpl;
    use super::Deposit;
    use core::num::traits::zero::Zero;

    #[test]
    fn test_get_deposit_id1() {
        DepositHelpersImpl::get_deposit_id(
            Zero::zero(),
            array![Deposit { recipient: 123.try_into().unwrap(), amount: 123 }].span(),
        );
    }

    #[test]
    fn test_get_deposit_id2() {
        DepositHelpersImpl::get_deposit_id(
            Zero::zero(),
            array![
                Deposit { recipient: 123.try_into().unwrap(), amount: 123 },
                Deposit { recipient: 345.try_into().unwrap(), amount: 356 },
            ]
                .span(),
        );
    }

    #[test]
    #[should_panic(expected: "Number of hashes should be a power of 2")]
    fn test_get_deposit_id3() {
        DepositHelpersImpl::get_deposit_id(
            Zero::zero(),
            array![
                Deposit { recipient: 123.try_into().unwrap(), amount: 123 },
                Deposit { recipient: 345.try_into().unwrap(), amount: 356 },
                Deposit { recipient: 678.try_into().unwrap(), amount: 678 },
            ]
                .span(),
        );
    }

    #[test]
    fn test_get_deposit_id4() {
        DepositHelpersImpl::get_deposit_id(
            Zero::zero(),
            array![
                Deposit { recipient: 123.try_into().unwrap(), amount: 123 },
                Deposit { recipient: 345.try_into().unwrap(), amount: 356 },
                Deposit { recipient: 678.try_into().unwrap(), amount: 678 },
                Deposit { recipient: 901.try_into().unwrap(), amount: 901 },
            ]
                .span(),
        );
    }
}

#[cfg(test)]
mod withdrawals_tests {
    use super::Bridge;
    use super::Bridge::{
        ProgresiveHelpersTrait, ProgresiveDepositHelpersImpl, DepositHelpersImpl,
        WithdrawalsTreeNode,
    };
    use crate::utils::word_array::{WordArray, WordArrayTrait};
    use crate::utils::hex::{to_hex, from_hex};

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

    #[test]
    #[ignore]
    fn test_print_hashes() {
        let l1_address = from_hex(
            "03bfac5406925f9fa00194aa5fd093f60775d90475dcf88c24359eddd385b398a8",
        );

        let l1_address: WordArray = Into::<ByteArray, WordArray>::into(l1_address);

        let leaf = ProgresiveHelpersTrait::hash256_withdrawal(l1_address.span(), 10);
        let node = ProgresiveHelpersTrait::hash256_inner_nodes(@leaf, @leaf);
        let node2 = ProgresiveHelpersTrait::hash256_inner_nodes(@node, @node);

        println!("leaf hash: {:?}", to_hex(@Into::<_, ByteArray>::into(leaf.hash)));
        println!("node hash: {:?}", to_hex(@Into::<_, ByteArray>::into(node.hash)));
        println!("node2 hash: {:?}", to_hex(@Into::<_, ByteArray>::into(node2.hash)));
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
    #[should_panic(expected: 'ERC20: insufficient allowance')]
    fn test_bridge_not_allowed_to_burn() {
        let (admin_address, alice_address, _, _, _, bridge) = fixture();

        cheat_caller_address(bridge.contract_address, admin_address, CheatSpan::TargetCalls(1));

        bridge
            .deposit(
                Default::default(),
                array![Deposit { recipient: alice_address, amount: 100 }].span(),
            );

        cheat_caller_address(bridge.contract_address, alice_address, CheatSpan::TargetCalls(1));

        bridge.withdraw(words_from_hex("8080").span(), 50);
    }

    #[test]
    fn test_basic_flow() {
        let (admin_address, alice_address, bob_address, carol_address, btc, bridge) = fixture();

        cheat_caller_address(bridge.contract_address, admin_address, CheatSpan::TargetCalls(1));

        bridge
            .deposit(
                Default::default(),
                array![
                    Deposit { recipient: alice_address, amount: 50 },
                    Deposit { recipient: alice_address, amount: 50 },
                ]
                    .span(),
            );

        assert_eq!(btc.total_supply(), 100);

        cheat_caller_address(btc.contract_address, alice_address, CheatSpan::TargetCalls(1));
        btc.transfer(bob_address, 50);

        cheat_caller_address(btc.contract_address, alice_address, CheatSpan::TargetCalls(1));
        btc.transfer(carol_address, 50);

        cheat_caller_address(btc.contract_address, bob_address, CheatSpan::TargetCalls(1));
        btc.approve(bridge.contract_address, 50);
        cheat_caller_address(bridge.contract_address, bob_address, CheatSpan::TargetCalls(1));
        bridge.withdraw(words_from_hex("8080").span(), 50);

        cheat_caller_address(btc.contract_address, carol_address, CheatSpan::TargetCalls(1));
        btc.approve(bridge.contract_address, 50);
        cheat_caller_address(bridge.contract_address, carol_address, CheatSpan::TargetCalls(1));
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

        cheat_caller_address(btc.contract_address, alice_address, CheatSpan::TargetCalls(1));
        btc.approve(bridge.contract_address, 2000);
        for _ in 0..ProgresiveDepositHelpersImpl::TREE_MAX_SIZE + 1 {
            cheat_caller_address(bridge.contract_address, alice_address, CheatSpan::TargetCalls(1));
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
                                root: 0x6f812e8a435a8aeb38affa6514bbfdd5410c2833f0f4f90222590c2ae707632_u256
                                    .into(),
                            },
                        ),
                    ),
                ],
            );
    }
}
