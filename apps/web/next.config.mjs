/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_ORIGIN?.replace(/\/$/, '');
    if (!apiOrigin) return [];

    return [{
      source: '/api/:path*',
      destination: `${apiOrigin}/api/:path*`
    }];
  }
};

export default nextConfig;
