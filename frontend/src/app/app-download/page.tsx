'use client'

import { config } from '@/config'
import type { MobileAppInfo } from '@/components/AppDownloadModal'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function pickAndroidUrl(info: MobileAppInfo | null): string {
	return (info?.android?.download_url || info?.download_url || config.MOBILE_APK_DOWNLOAD_URL).trim()
}

function AppDownloadContent() {
	const searchParams = useSearchParams()
	const platform = searchParams.get('platform')
	const [info, setInfo] = useState<MobileAppInfo | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetch(`${config.API_URL}/api/mobile/app-info/`)
			.then(r => r.json())
			.then(setInfo)
			.catch(() => setInfo(null))
			.finally(() => setLoading(false))
	}, [])

	const androidUrl = pickAndroidUrl(info)

	if (loading) {
		return (
			<main className='min-h-screen bg-gray-bg flex items-center justify-center p-6'>
				<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-main1' />
			</main>
		)
	}

	if (!platform) {
		return (
			<main className='min-h-screen bg-gray-bg flex items-center justify-center p-6'>
				<div className='max-w-md w-full bg-white rounded-2xl shadow-lg p-6 space-y-4'>
					<h1 className='text-2xl font-bold text-black'>VizHub AR</h1>
					<p className='text-sm text-gray'>Выберите платформу для установки приложения.</p>
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
						<Link
							href='/app-download?platform=android'
							className='flex flex-col items-center justify-center gap-2 p-5 border-2 border-gray2 rounded-xl hover:border-main1 hover:bg-main1/5 transition-colors'
						>
							<span className='text-3xl'>🤖</span>
							<span className='font-semibold text-black'>Android</span>
						</Link>
						<Link
							href='/ar-app'
							className='flex flex-col items-center justify-center gap-2 p-5 border-2 border-gray2 rounded-xl hover:border-main1 hover:bg-main1/5 transition-colors'
						>
							<span className='text-3xl'>🍎</span>
							<span className='font-semibold text-black'>iOS</span>
						</Link>
					</div>
					<Link href='/' className='block text-center text-sm text-main1 underline'>
						На главную
					</Link>
				</div>
			</main>
		)
	}

	if (platform === 'ios') {
		return (
			<main className='min-h-screen bg-gray-bg flex items-center justify-center p-6'>
				<div className='max-w-md w-full bg-white rounded-2xl shadow-lg p-6 space-y-4'>
					<h1 className='text-2xl font-bold text-black'>VizHub AR для iPhone</h1>
					<p className='text-sm text-gray'>
						Откройте мини-приложение в Safari — каталог 3D и примерка в комнате через камеру.
						Устанавливать из App Store не нужно.
					</p>
					<ol className='text-sm text-gray list-decimal list-inside space-y-1'>
						<li>Откройте AR-каталог</li>
						<li>Выберите товар → «Примерить в AR»</li>
						<li>Опционально: «Поделиться» → «На экран Домой»</li>
					</ol>
					<Link
						href='/ar-app'
						className='block w-full text-center bg-main1 text-white py-3 rounded-xl font-medium hover:bg-main2 transition-colors'
					>
						Открыть AR-приложение
					</Link>
					<Link href='/app-download' className='block text-center text-sm text-main1 underline'>
						Выбрать другую платформу
					</Link>
				</div>
			</main>
		)
	}

	const canDownload = Boolean(androidUrl)
	return (
		<main className='min-h-screen bg-gray-bg flex items-center justify-center p-6'>
			<div className='max-w-md w-full bg-white rounded-2xl shadow-lg p-6 space-y-4'>
				<h1 className='text-2xl font-bold text-black'>VizHub AR для Android</h1>
				<p className='text-sm text-gray'>
					Скачайте APK и установите на телефон. В списке товаров выберите модель и нажмите
					«Примерить» — камера покажет мебель в комнате.
				</p>
				<ol className='text-sm text-gray list-decimal list-inside space-y-1'>
					<li>Скачайте APK</li>
					<li>Разрешите установку из неизвестных источников</li>
					<li>Откройте приложение и войдите</li>
				</ol>
				{canDownload ? (
					<a
						href={androidUrl}
						download
						className='block w-full text-center bg-main1 text-white py-3 rounded-xl font-medium hover:bg-main2 transition-colors'
					>
						Скачать APK
					</a>
				) : (
					<p className='text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3'>
						APK пока не выложен. Администратор задаёт MOBILE_APK_DOWNLOAD_URL на сервере.
					</p>
				)}
				<Link href='/app-download' className='block text-center text-sm text-main1 underline'>
					Выбрать другую платформу
				</Link>
			</div>
		</main>
	)
}

export default function AppDownloadPage() {
	return (
		<Suspense
			fallback={
				<main className='min-h-screen bg-gray-bg flex items-center justify-center p-6'>
					<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-main1' />
				</main>
			}
		>
			<AppDownloadContent />
		</Suspense>
	)
}
