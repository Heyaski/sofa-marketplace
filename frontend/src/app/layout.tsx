import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import '../styles/globals.css'
import ModelPrefetcher from '@/components/ModelPrefetcher'

const inter = Inter({ subsets: ['latin'] })
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const metadata: Metadata = {
	title: 'VizHub.pro - Маркетплейс 3D моделей мебели',
	description:
		'Реалистичная мебель в 3D для интерьеров, которые хочется трогать',
	viewport: {
		width: 'device-width',
		initialScale: 1,
		maximumScale: 5,
		viewportFit: 'cover',
	},
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang='ru'>
			<body className={inter.className}>
				<Script
					src={`/model-prefetch.js?api=${encodeURIComponent(API_URL)}`}
					strategy='beforeInteractive'
				/>
				<ModelPrefetcher />
				{children}
			</body>
		</html>
	)
}
