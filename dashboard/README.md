# Dashboard

This is a dashboard for the [Pontis](https://github.com/Bitcoin-Wildlife-Sanctuary/pontis) project.
It is built using [NextJS](https://nextjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/).

## Development

Create an `.env` file in the root directory of the dashboard and fill in the required values from the `.env.example` file.

Install the dependencies by running:

```bash
yarn install
```

To start the development server, run:

```bash
yarn dev
```

## Deployment

Create an `.env` file in the root directory of the dashboard and fill in the required values from the `.env.example` file.
You can also use production versions of the `.env` file, for example `.env.production`.

To build the project, run:

```bash
yarn build
```

To start the production server, run:

```bash
yarn start
```

## Deployment to Cloud Services (Vercel, Netlify, AWS Amplify etc.)

- Set up the deployment environment variables in the cloud service provider's dashboard.
- Either deploy the project manually or set up automatic deployments from git branches.
- If the project is not recognized as a NextJS project, you may need to set up the build command and the output directory manually.
