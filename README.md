# Pontis

`OP_CAT` enabled Bitcoin &lt;> Starknet Bridge POC

## Intro

These POC builds of previous [Bridge Covenant POC](https://starkware.co/blog/implementing-a-bridge-covenant-on-op-cat-bitcoin/). It explores "easy" parts of the potentatial bridge implementation, ignoring more difficult parts of the design like dual finality, reorgs etc.

## Limitations

* only happy path is tested/implemented, problems with sending transactions are ignored
* there is a bridge instance constraint missing in the deposit covenant, right now there is no way to specify which bridge instance deposit is meant to be added to after aggregation
* deposit/withdrawal amount is limited to int32.max, this applies also to a deposit/withdrawal batch total
* there might be only 16 'open' deposit batches
* deposit batch size should be a power of 2
* withdrawal amount should be bigger than what l1 considers dust (330)

## Architecture

<p align="center" width="100%">
  <img src="./docs/img/architecture.svg" alt="architecture"/>
</p>

## Covenants

<p align="center" width="100%">
  <img src="./docs/img/covenants.svg" alt="architecture"/>
</p>