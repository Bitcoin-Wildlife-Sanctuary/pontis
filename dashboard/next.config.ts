import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: {
      ssr: true,
    },
  },
  typescript: {
    // TODO: Remove this when the issue is fixed
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
