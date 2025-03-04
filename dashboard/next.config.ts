import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  compiler: {
    styledComponents: {
      ssr: true,
    },
  },
};

export default nextConfig;
