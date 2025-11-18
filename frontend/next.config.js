/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	images: {
		remotePatterns: [
			{
				protocol: 'http',
				hostname: '127.0.0.1',
				port: '8000',
				pathname: '/media/**',
			},
			{
				protocol: 'http',
				hostname: 'localhost',
				port: '8000',
				pathname: '/media/**',
			},
			{
				protocol: 'https',
				hostname: 'api.yourdomain.com',
				pathname: '/media/**',
			},
		],
		unoptimized: true,
	},
}

module.exports = nextConfig
