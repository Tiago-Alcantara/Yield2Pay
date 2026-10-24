import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // @yield2pay/shared is a source-only workspace package (TS in src/); Next must
  // transpile it so the build resolves it on Vercel without relying solely on
  // the tsconfig path alias.
  transpilePackages: ["@yield2pay/shared"],
  async redirects() {
    const financial =
      process.env.FINANCIAL_PRODUCT_ENABLED === 'true' ||
      process.env.NEXT_PUBLIC_FINANCIAL_PRODUCT === 'true';
    const family = [
      { source: '/family', destination: '/', permanent: false },
      {
        source: '/family/:slug((?!deposito$|saque$)[^/]+)',
        destination: '/:slug',
        permanent: false,
      },
      {
        source: '/family/:slug((?!deposito$|saque$)[^/]+)/:rest*',
        destination: '/:slug/:rest*',
        permanent: false,
      },
    ];
    if (!financial) return family;
    return [
      ...family,
      { source: '/family/deposito', destination: '/deposito', permanent: false },
      { source: '/family/saque', destination: '/saque', permanent: false },
      { source: '/deposit', destination: '/b2b/deposit', permanent: false },
      { source: '/withdraw', destination: '/b2b/withdraw', permanent: false },
    ];
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
