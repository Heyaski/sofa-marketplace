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
			// Для продакшена - используем домен из переменной окружения или дефолтный
			...(process.env.NEXT_PUBLIC_API_URL
				? [
						{
							protocol: process.env.NEXT_PUBLIC_API_URL.startsWith('https')
								? 'https'
								: 'http',
							hostname: process.env.NEXT_PUBLIC_API_URL.replace(
								/^https?:\/\//,
								''
							)
								.split(':')[0]
								.split('/')[0],
							pathname: '/media/**',
						},
				  ]
				: []),
			// Fallback для стандартного домена
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
