import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
	title: 'VizHub AR',
	description: '3D каталог и примерка мебели в AR — работает в Safari на iPhone',
	manifest: '/ar-app-manifest.webmanifest',
	appleWebApp: {
		capable: true,
		statusBarStyle: 'default',
		title: 'VizHub AR',
	},
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: 'cover',
	themeColor: '#111827',
}

export default function ArAppLayout({ children }: { children: React.ReactNode }) {
	return children
}
