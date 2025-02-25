# sCrypt POC Bridge Covenant

Implementation of the POC bridge covenant for StarkNet.

## Configure Private Key

First, we need to create a .env file with our private key, which should contain some signet funds:

```
PRIVATE_KEY="cTE..."
```

you can genereate private key by running:

```sh
npm run genkey
```

You may obtain signet funds via these faucets:

- https://signetfaucet.com/
- https://alt.signetfaucet.com
- https://x.com/babylon_chain/status/1790787732643643575

## Install Dependencies

```sh
npm i
```

## Build

```sh
npm run build
```

## Testing Locally

The following command will run a full end-to-end test locally. This includes assembly and local execution of covenant transactions.

```sh
npm t
```

## Testing on fractal-testnet

```sh
npm run test:fractal-testnet
```



