# Dashboard

This is a dashboard for the [Pontis](https://github.com/Bitcoin-Wildlife-Sanctuary/pontis) project.
It is built using [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Vite](https://vitejs.dev/).

## Development

Copy the `.env.example` file to `.env` and fill in the required values.

Install the dependencies by running:

```bash
yarn install
```

To serve the operator state, run:

```bash
yarn serve path/to/operator/state.json
```

To start the development server, run:

```bash
yarn start
```

## Deployment

Fill in the required values in the `.env` file.

To build the project, run:

```bash
yarn build
```

You can then serve the `dist` directory using any static file server.
