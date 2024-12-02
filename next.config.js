/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  webpack: (config, {isServer}) => {
    if (isServer) {
      config.devtool = 'source-map'
    }
    return config
  },
}

module.exports = nextConfig
