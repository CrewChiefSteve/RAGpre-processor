/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow ES modules from our src/ directory
  experimental: {
    serverComponentsExternalPackages: ['sharp', '@azure/ai-form-recognizer', 'pdfjs-dist', 'canvas'],
  },
  // Webpack config to handle ESM modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't attempt to load server-only modules on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
