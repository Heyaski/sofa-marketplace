/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		appDir: true,
	},
	images: {
		domains: ['localhost'],
		unoptimized: true, // Для статических изображений
	},
}

module.exports = nextConfig
