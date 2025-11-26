import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'VizHub.art - Маркетплейс 3D моделей мебели',
	description:
		'Реалистичная мебель в 3D для интерьеров, которые хочется трогать',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang='ru'>
			<body className={inter.className}>{children}</body>
		</html>
	)
}
