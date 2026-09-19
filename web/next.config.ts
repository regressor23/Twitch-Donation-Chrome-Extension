import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `@tipvault/shared` ships TypeScript source, not a build artifact, so Next
   * has to compile it as part of the app rather than treat it as a prebuilt
   * dependency.
   */
  transpilePackages: ['@tipvault/shared'],
};

export default nextConfig;
