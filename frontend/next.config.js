/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental: {
  //   appDir: true,
  // },
  // Enable standalone output for Docker
  output: 'standalone',
  
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://prometheus-retention-api:8000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/prometheus-proxy/:path*',
        destination: `${backendUrl}/prometheus-proxy/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
    ]
  },
  
  // Image optimization for Docker
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
