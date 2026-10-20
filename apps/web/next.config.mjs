/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiOrigin = (process.env.API_PROXY_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL)?.replace(/\/$/, '');
    if (!apiOrigin) return [];

    return [{
      source: '/api/:path*',
      destination: `${apiOrigin}/api/:path*`
    }];
  }
};

export default nextConfig;
