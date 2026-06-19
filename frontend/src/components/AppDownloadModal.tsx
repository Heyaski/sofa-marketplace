'use client'

import { config } from '@/config'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export type MobilePlatformInfo = {
	download_url?: string
	available?: boolean
	format?: string
}

export type MobileAppInfo = {
	app_name?: string
	android?: MobilePlatformInfo
	ios?: MobilePlatformInfo
	download_url?: string
	available?: boolean
}

type AppDownloadModalProps = {
	isOpen: boolean
	onClose: () => void
}

function pickAndroidUrl(info: MobileAppInfo | null): string {
	return (info?.android?.download_url || info?.download_url || config.MOBILE_APK_DOWNLOAD_URL).trim()
}

function pickAndroidUrl(info: MobileAppInfo | null): string {
	return (info?.android?.download_url || info?.download_url || config.MOBILE_APK_DOWNLOAD_URL).trim()
}

export default function AppDownloadModal({ isOpen, onClose }: AppDownloadModalProps) {
	const router = useRouter()
	const [info, setInfo] = useState<MobileAppInfo | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (!isOpen) return
		setLoading(true)
		fetch(`${config.API_URL}/api/mobile/app-info/`)
			.then(r => r.json())
			.then(setInfo)
			.catch(() => setInfo(null))
			.finally(() => setLoading(false))
	}, [isOpen])

	if (!isOpen) return null

	const androidUrl = pickAndroidUrl(info)
	const androidReady = Boolean(androidUrl)

	const openAndroid = () => {
		if (androidReady) {
			router.push('/app-download?platform=android')
			onClose()
			return
		}
		router.push('/app-download?platform=android')
		onClose()
	}

	const openIos = () => {
		onClose()
		window.location.href = '/ar-app'
	}

	return (
		<div className='fixed inset-0 z-[210] flex items-center justify-center p-4'>
			<div className='absolute inset-0 bg-black/50' onClick={onClose} />
			<div className='relative w-full max-w-md bg-white rounded-2xl shadow-xl p-5 sm:p-6'>
				<button
					type='button'
					onClick={onClose}
					className='absolute top-4 right-4 text-gray hover:text-black'
					aria-label='Закрыть'
				>
					✕
				</button>

				<h2 className='text-xl font-bold text-black mb-2 pr-8'>Скачать приложение AR</h2>
				<p className='text-sm text-gray mb-5'>
					Android — установка APK. iPhone — веб-приложение в Safari с AR-примеркой (без App Store).
				</p>

				{loading ? (
					<div className='flex justify-center py-8'>
						<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
					</div>
				) : (
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
						<button
							type='button'
							onClick={openAndroid}
							className='flex flex-col items-center justify-center gap-2 p-5 border-2 border-gray2 rounded-xl hover:border-main1 hover:bg-main1/5 transition-colors'
						>
							<span className='text-3xl' aria-hidden>
								🤖
							</span>
							<span className='font-semibold text-black'>Android</span>
							<span className='text-xs text-gray text-center'>
								{androidReady ? 'Скачать APK' : 'Инструкция по установке'}
							</span>
						</button>

						<button
							type='button'
							onClick={openIos}
							className='flex flex-col items-center justify-center gap-2 p-5 border-2 border-gray2 rounded-xl hover:border-main1 hover:bg-main1/5 transition-colors'
						>
							<span className='text-3xl' aria-hidden>
								🍎
							</span>
							<span className='font-semibold text-black'>iOS</span>
							<span className='text-xs text-gray text-center'>
								Открыть в Safari
							</span>
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
