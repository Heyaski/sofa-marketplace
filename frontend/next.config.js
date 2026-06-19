/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const nextConfig = {
	output: 'standalone',
	transpilePackages: ['three', 'web-ifc-three', 'three-mesh-bvh'],
	// Проксируем /media/* на API — GLB/изображения отдаются бэкендом, браузер идёт на www
	async rewrites() {
		return [
			{
				source: '/media/:path*',
				destination: `${apiUrl}/media/:path*`,
			},
			// iPhone AR Quick Look: URL должен заканчиваться на .usdz (same-origin)
			{
				source: '/ar-usdz/:productId/model.usdz',
				destination: '/api/ar-usdz-proxy/:productId',
			},
		]
	},
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
			// Домен для продакшена
			{
				protocol: 'https',
				hostname: 'api.vizhub.pro',
				pathname: '/media/**',
			},
			// S3 Beget — glb2d_*.png и медиа с бакета
			{
				protocol: 'https',
				hostname: 's3.ru1.storage.beget.cloud',
				pathname: '/**',
			},
		],
		unoptimized: true,
	},
}

module.exports = nextConfig
