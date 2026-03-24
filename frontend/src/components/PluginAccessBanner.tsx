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
	const [showActivationCell, setShowActivationCell] = useState(false)
	const [showVersions, setShowVersions] = useState(false)
	const [showSubscriptionHint, setShowSubscriptionHint] = useState(false)
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

	const handleDownloadClick = () => {
		if (!canUsePlugin) {
			setShowSubscriptionHint(true)
			return
		}
		setShowActivationCell(true)
		if (!pluginDownloadUrl) {
			setActivationError('Ссылка на файл плагина пока не настроена. Обратитесь к администратору.')
		}
	}

	return (
		<div className='rounded-xl border border-main1/20 bg-main1/5 p-4 sm:p-5'>
			<div className='flex flex-col gap-3'>
				<div>
					<h3 className='text-lg font-semibold text-black'>Доступ к плагину</h3>
					{loading ? (
						<p className='text-sm text-gray mt-1'>Проверяем статус аккаунта...</p>
					) : !isAuthenticated ? (
						<p className='text-sm text-gray mt-1'>
							Попробуйте активацию ключа и доступ к библиотеке через плагин. После покупки подписки ключ появится в профиле.
						</p>
					) : !canUsePlugin ? (
						<p className='text-sm text-gray mt-1'>
							Плагин доступен на платных тарифах. Купите подписку, чтобы получить ключ и открыть загрузку моделей из плагина.
						</p>
					) : (
						<p className='text-sm text-gray mt-1'>
							Нажмите «Скачать плагин», вставьте ключ в ячейку и активируйте доступ.
						</p>
					)}
				</div>

				<div className='rounded-lg bg-white border border-gray2 p-3'>
					<p className='text-sm text-gray mb-2'>URL сервера для плагина</p>
					<p className='text-xs sm:text-sm text-black mb-2'>
						В плагине в поле <span className='font-semibold'>Server URL / ApiBaseUrl</span> вставьте этот адрес:
					</p>
					<div className='flex flex-col sm:flex-row gap-2'>
						<input
							readOnly
							value={serverUrl}
							className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black font-mono text-xs sm:text-sm'
						/>
						<button
							onClick={() => copyToClipboard(serverUrl, 'url')}
							className='w-full sm:w-auto px-4 py-2 rounded-lg border border-main1 text-main1 hover:bg-main1 hover:text-white transition-colors'
						>
							{copiedField === 'url' ? 'Скопировано' : 'Скопировать URL'}
						</button>
					</div>
				</div>

				<div className='rounded-lg bg-white border border-gray2 p-3'>
					<p className='text-sm text-gray mb-2'>Ключ доступа (license key)</p>
					<div className='flex flex-col sm:flex-row gap-2'>
						<input
							readOnly
							value={licenseKeyHash}
							placeholder='Ключ появится после покупки подписки'
							className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black font-mono text-xs sm:text-sm'
						/>
						<button
							onClick={() => copyToClipboard(licenseKeyHash, 'key')}
							disabled={!licenseKeyHash}
							className='w-full sm:w-auto px-4 py-2 rounded-lg border border-main1 text-main1 hover:bg-main1 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
						>
							{copiedField === 'key' ? 'Скопировано' : 'Скопировать ключ'}
						</button>
					</div>
				</div>

				<div className='rounded-lg border border-dashed border-main1/40 p-3 bg-white/80'>
					<p className='text-sm font-medium text-black mb-1'>Как подключить плагин за 1 минуту:</p>
					<p className='text-sm text-gray'>1) Скопируйте URL и вставьте в настройки плагина.</p>
					<p className='text-sm text-gray'>2) Выберите и скачайте версию плагина для вашего Revit.</p>
					<p className='text-sm text-gray'>3) Вставьте ключ, активируйте и работайте по сценарию плагина.</p>
				</div>

				<div className='flex flex-col gap-2'>
					<p className='text-sm text-black'>Скачать плагин:</p>
					<button
						onClick={() => {
							if (!canUsePlugin) {
								setShowSubscriptionHint(true)
								return
							}
							setShowVersions(prev => !prev)
							setShowActivationCell(true)
						}}
						className='w-full sm:w-auto inline-flex justify-center items-center bg-main1 text-white px-5 py-2.5 rounded-lg hover:bg-main2 transition-colors'
					>
						Скачать плагин
					</button>

					{showSubscriptionHint && !canUsePlugin && (
						<div className='rounded-lg bg-yellow-50 border border-yellow-200 p-3'>
							<p className='text-sm text-yellow-800 mb-2'>
								Чтобы скачать плагин, приобретите подписку.
							</p>
							<a
								href={
									isAuthenticated
										? '/profile?tab=subscription'
										: '/?auth=register&next=%2Fprofile%3Ftab%3Dsubscription'
								}
								className='w-full sm:w-auto inline-flex justify-center items-center border border-main1 text-main1 px-4 py-2 rounded-lg hover:bg-main1 hover:text-white transition-colors'
							>
								Купить подписку
							</a>
						</div>
					)}

					{showVersions && canUsePlugin && (
						<div className='rounded-lg bg-white border border-gray2 p-3'>
							<p className='text-sm text-gray mb-2'>Выберите версию Revit:</p>
							<div className='flex flex-col sm:flex-row gap-2'>
								{pluginDownloadUrls.length > 0 ? (
									pluginDownloadUrls.map(item => (
										<a
											key={item.version}
											href={item.url}
											target='_blank'
											rel='noopener noreferrer'
											onClick={handleDownloadClick}
											className='w-full sm:w-auto inline-flex justify-center items-center border border-main1 text-main1 px-4 py-2 rounded-lg hover:bg-main1 hover:text-white transition-colors'
										>
											{item.version}
										</a>
									))
								) : (
									<a
										href={pluginDownloadUrl || undefined}
										target='_blank'
										rel='noopener noreferrer'
										onClick={handleDownloadClick}
										className='w-full sm:w-auto inline-flex justify-center items-center border border-main1 text-main1 px-4 py-2 rounded-lg hover:bg-main1 hover:text-white transition-colors'
									>
										Открыть ссылку скачивания
									</a>
								)}
							</div>
						</div>
					)}

					{canUsePlugin && (
						<button
							onClick={handleActivate}
							disabled={isActivating}
							className='w-full sm:w-auto bg-main1 text-white px-5 py-2.5 rounded-lg hover:bg-main2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
						>
							{isActivating ? 'Активация...' : 'Активировать плагин'}
						</button>
					)}
				</div>

				{showActivationCell && (
					<div className='rounded-lg bg-white border border-gray2 p-3'>
						<label className='block text-sm text-gray mb-2'>Ячейка активации ключа</label>
						<input
							value={manualLicenseKey}
							onChange={e => setManualLicenseKey(e.target.value)}
							placeholder='Вставьте ключ из профиля'
							className='w-full px-3 py-2 rounded-lg bg-gray-bg text-black font-mono text-xs sm:text-sm'
						/>
					</div>
				)}

				{isActivated && (
					<div className='rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700'>
						Ключ подтвержден. Доступ к сценарию плагина открыт.
					</div>
				)}

				{activationError && (
					<div className='rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700'>
						{activationError}
					</div>
				)}
			</div>
		</div>
	)
}
