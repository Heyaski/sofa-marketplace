'use client'

import { useEffect, useMemo, useState } from 'react'
import { authService } from '@/services/api'
import { User } from '@/types'
import { config } from '@/config'

const PAID_SUBSCRIPTIONS = new Set(['basic', 'pro', 'premium'])

export default function PluginAccessBanner() {
	const [loading, setLoading] = useState(true)
	const [user, setUser] = useState<User | null>(null)
	const [activationError, setActivationError] = useState<string | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [copiedField, setCopiedField] = useState<'pluginUrl' | null>(null)

	useEffect(() => {
		const loadUser = async () => {
			try {
				const token = localStorage.getItem('access_token')
				if (!token) {
					setUser(null)
					return
				}
				const currentUser = await authService.getCurrentUser()
				setUser(currentUser)
			} catch {
				setUser(null)
			} finally {
				setLoading(false)
			}
		}

		loadUser()
	}, [])

	const subscriptionType = user?.profile?.subscription_type || 'free'
	const isAuthenticated = Boolean(user)
	const canUsePlugin = useMemo(
		() => PAID_SUBSCRIPTIONS.has(subscriptionType),
		[subscriptionType]
	)
	const licenseKeyHash = user?.profile?.license_key_hash || ''
	const keyedDomain = config.PLUGIN_KEYED_API_BASE_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '')
	const pluginApiUrl = licenseKeyHash ? `https://${licenseKeyHash}.${keyedDomain}` : ''
	const pluginApiUrlDisplay = licenseKeyHash ? `https://${licenseKeyHash}` : ''
	const pluginDownloadUrl = config.PLUGIN_DOWNLOAD_URL.trim()
	const pluginDownloadUrls = [
		{ version: 'Revit 2022', url: config.PLUGIN_DOWNLOAD_URL_2022.trim() },
		{ version: 'Revit 2023', url: config.PLUGIN_DOWNLOAD_URL_2023.trim() },
		{ version: 'Revit 2024', url: config.PLUGIN_DOWNLOAD_URL_2024.trim() },
	].filter(item => item.url)

	const copyToClipboard = async (value: string) => {
		if (!value.trim()) return
		try {
			await navigator.clipboard.writeText(value)
			setCopiedField('pluginUrl')
			window.setTimeout(() => setCopiedField(null), 1500)
		} catch {
			setCopiedField(null)
		}
	}

	const openDownloadModal = () => {
		setIsModalOpen(true)
		setActivationError(null)
		if (!pluginDownloadUrl) {
			setActivationError('Ссылка на файл плагина пока не настроена. Обратитесь к администратору.')
		}
	}

	const openRegisterModal = () => {
		window.dispatchEvent(
			new CustomEvent('open-auth-modal', {
				detail: { mode: 'register', next: '/profile?tab=subscription' },
			})
		)
		setIsModalOpen(false)
	}

	return (
		<>
			<div className='rounded-xl border border-main1/20 bg-main1/5 p-3 sm:p-4 max-w-md'>
				<button
					onClick={openDownloadModal}
					className='w-full inline-flex justify-center items-center bg-main1 text-white px-5 py-3 rounded-lg hover:bg-main2 transition-colors font-medium'
				>
					Скачать плагин
				</button>
			</div>

			{isModalOpen && (
				<div className='fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4'>
					<div className='w-full max-w-md bg-white rounded-xl p-4 sm:p-5 shadow-xl'>
						<div className='flex items-center justify-between mb-3'>
							<h3 className='text-lg font-semibold text-black'>Скачивание и активация</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className='text-gray hover:text-black transition-colors'
								aria-label='Закрыть'
							>
								✕
							</button>
						</div>

						{!canUsePlugin ? (
							<div className='space-y-3'>
								<p className='text-sm text-gray'>
									Чтобы скачать плагин, приобретите подписку.
								</p>
								{isAuthenticated ? (
									<a
										href='/profile?tab=subscription'
										className='w-full inline-flex justify-center items-center border border-main1 text-main1 px-4 py-2 rounded-lg hover:bg-main1 hover:text-white transition-colors'
									>
										Купить подписку
									</a>
								) : (
									<button
										onClick={openRegisterModal}
										className='w-full inline-flex justify-center items-center border border-main1 text-main1 px-4 py-2 rounded-lg hover:bg-main1 hover:text-white transition-colors'
									>
										Купить подписку
									</button>
								)}
							</div>
						) : (
							<div className='space-y-3'>
								<div className='rounded-lg bg-gray-bg p-3'>
									<p className='text-xs text-gray mb-1'>
										Вставьте этот адрес в плагин (домен скрыт, при копировании вставится полный адрес):
									</p>
									<div className='flex flex-col sm:flex-row gap-2'>
										<input
											readOnly
											value={pluginApiUrlDisplay}
											placeholder='Ключ появится после покупки подписки'
											className='w-full px-3 py-2 rounded-lg bg-white text-black font-mono text-xs sm:text-sm'
										/>
										<button
											onClick={() => copyToClipboard(pluginApiUrl)}
											disabled={!pluginApiUrl}
											className='px-3 py-2 rounded-lg border border-main1 text-main1 hover:bg-main1 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
										>
											{copiedField === 'pluginUrl' ? 'OK' : 'Копировать'}
										</button>
									</div>
									<p className='mt-2 text-[11px] text-gray'>
										Полный адрес, который копируется: <span className='font-mono text-black'>{pluginApiUrl}</span>
									</p>
								</div>

								<div className='flex flex-wrap gap-2'>
									{pluginDownloadUrls.length > 0 ? (
										pluginDownloadUrls.map(item => (
											<a
												key={item.version}
												href={item.url}
												target='_blank'
												rel='noopener noreferrer'
												className='inline-flex justify-center items-center border border-main1 text-main1 px-3 py-1.5 rounded-lg hover:bg-main1 hover:text-white transition-colors text-sm'
											>
												{item.version}
											</a>
										))
									) : (
										<a
											href={pluginDownloadUrl || undefined}
											target='_blank'
											rel='noopener noreferrer'
											className='inline-flex justify-center items-center border border-main1 text-main1 px-3 py-1.5 rounded-lg hover:bg-main1 hover:text-white transition-colors text-sm'
										>
											Скачать файл
										</a>
									)}
								</div>
							</div>
						)}

						{activationError && (
							<div className='rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mt-3'>
								{activationError}
							</div>
						)}
					</div>
				</div>
			)}
		</>
	)
}
