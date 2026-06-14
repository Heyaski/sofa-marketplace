'use client'

import { config } from '@/config'
import { useEffect, useState } from 'react'

type AppInfo = {
	download_url?: string
	available?: boolean
	app_name?: string
}

export default function AppDownloadPage() {
	const [info, setInfo] = useState<AppInfo | null>(null)
	const fallbackUrl = config.MOBILE_APK_DOWNLOAD_URL.trim()

	useEffect(() => {
		fetch(`${config.API_URL}/api/mobile/app-info/`)
			.then(r => r.json())
			.then(setInfo)
			.catch(() => setInfo(null))
	}, [])

	const apkUrl = (info?.download_url || fallbackUrl).trim()
	const canDownload = Boolean(apkUrl)

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
						href={apkUrl}
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
				<a href='/' className='block text-center text-sm text-main1 underline'>
					На главную
				</a>
			</div>
		</main>
	)
}
