/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'myblogdata84.s3.us-east-1.amazonaws.com',
      's3.us-east-1.amazonaws.com',
      'localhost'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'myblogdata84.s3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/myblogdata84/**',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
};

module.exports = nextConfig;
