'use client'

import { useEffect, useMemo, useState } from 'react'
import { authService, pluginService } from '@/services/api'
import { User } from '@/types'
import { config } from '@/config'

const PAID_SUBSCRIPTIONS = new Set(['basic', 'pro', 'premium'])

export default function PluginAccessBanner() {
	const [loading, setLoading] = useState(true)
	const [user, setUser] = useState<User | null>(null)
	const [isActivated, setIsActivated] = useState(false)
	const [activationError, setActivationError] = useState<string | null>(null)
	const [isActivating, setIsActivating] = useState(false)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [manualLicenseKey, setManualLicenseKey] = useState('')
	const [copiedField, setCopiedField] = useState<'url' | 'key' | null>(null)

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
	const serverUrl = config.API_URL.replace(/\/+$/, '')
	const pluginDownloadUrl = config.PLUGIN_DOWNLOAD_URL.trim()
	const pluginDownloadUrls = [
		{ version: 'Revit 2022', url: config.PLUGIN_DOWNLOAD_URL_2022.trim() },
		{ version: 'Revit 2023', url: config.PLUGIN_DOWNLOAD_URL_2023.trim() },
		{ version: 'Revit 2024', url: config.PLUGIN_DOWNLOAD_URL_2024.trim() },
	].filter(item => item.url)

	useEffect(() => {
		if (licenseKeyHash) {
			setManualLicenseKey(licenseKeyHash)
		}
	}, [licenseKeyHash])

	const copyToClipboard = async (value: string, field: 'url' | 'key') => {
		if (!value.trim()) return
		try {
			await navigator.clipboard.writeText(value)
			setCopiedField(field)
			window.setTimeout(() => setCopiedField(null), 1500)
		} catch {
			setCopiedField(null)
		}
	}

	const handleActivate = async () => {
		const keyToCheck = manualLicenseKey.trim()
		if (!keyToCheck) {
			setActivationError('Вставьте ключ в ячейку и повторите активацию.')
			setIsActivated(false)
			return
		}

		setActivationError(null)
		setIsActivating(true)
		try {
			const result = await pluginService.activate(keyToCheck)
			if (result.valid) {
				setIsActivated(true)
				setActivationError(null)
			} else {
				setIsActivated(false)
				setActivationError(result.error || 'Не удалось активировать плагин.')
			}
		} catch {
			setIsActivated(false)
			setActivationError('Ошибка активации. Проверьте соединение и попробуйте снова.')
		} finally {
			setIsActivating(false)
		}
	}

	const openDownloadModal = () => {
		setIsModalOpen(true)
		setActivationError(null)
		setIsActivated(false)
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
			<div className='rounded-xl border border-main1/20 bg-main1/5 p-4 sm:p-5'>
				<button
					onClick={openDownloadModal}
					className='w-full sm:w-auto inline-flex justify-center items-center bg-main1 text-white px-5 py-2.5 rounded-lg hover:bg-main2 transition-colors'
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
								<div className='text-xs text-gray'>
									URL для плагина: <span className='font-mono text-black'>{serverUrl}</span>
								</div>
								<div className='flex gap-2'>
									<input
										value={manualLicenseKey}
										onChange={e => setManualLicenseKey(e.target.value)}
										placeholder='Вставьте ключ из профиля'
										className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black font-mono text-xs sm:text-sm'
									/>
									<button
										onClick={() => copyToClipboard(licenseKeyHash, 'key')}
										disabled={!licenseKeyHash}
										className='px-3 py-2 rounded-lg border border-main1 text-main1 hover:bg-main1 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
									>
										{copiedField === 'key' ? 'OK' : 'Ключ'}
									</button>
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

								<button
									onClick={handleActivate}
									disabled={isActivating}
									className='w-full bg-main1 text-white px-5 py-2.5 rounded-lg hover:bg-main2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
								>
									{isActivating ? 'Активация...' : 'Активировать плагин'}
								</button>

								{isActivated && (
									<div className='rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700'>
										Ключ подтвержден. Доступ открыт.
									</div>
								)}
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
