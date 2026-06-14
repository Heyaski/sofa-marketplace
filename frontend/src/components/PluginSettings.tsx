'use client'

import { authService, pluginService } from '@/services/api'
import { User } from '@/types'
import { useEffect, useState } from 'react'

const PAID = new Set(['basic', 'pro', 'premium'])

export default function PluginSettings({ user, onUserUpdated }: { user: User; onUserUpdated?: (u: User) => void }) {
	const [offlinePath, setOfflinePath] = useState(user.profile?.plugin_offline_models_path || '')
	const [storageBackend, setStorageBackend] = useState<
		'vizhub_cloud' | 'local_first' | 'local_only'
	>((user.profile?.plugin_storage_backend as 'vizhub_cloud' | 'local_first' | 'local_only') || 'local_first')
	const [saving, setSaving] = useState(false)
	const [resending, setResending] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		setOfflinePath(user.profile?.plugin_offline_models_path || '')
		setStorageBackend(
			(user.profile?.plugin_storage_backend as 'vizhub_cloud' | 'local_first' | 'local_only') ||
				'local_first'
		)
	}, [user])

	if (!PAID.has(user.profile?.subscription_type || 'free')) {
		return null
	}

	const saveSettings = async () => {
		try {
			setSaving(true)
			setError(null)
			const updated = await authService.updateUser({
				profile: {
					plugin_offline_models_path: offlinePath.trim(),
					plugin_storage_backend: storageBackend,
				},
			})
			onUserUpdated?.(updated)
			setMessage('Настройки плагина сохранены')
		} catch {
			setError('Не удалось сохранить настройки')
		} finally {
			setSaving(false)
		}
	}

	const resendEmail = async () => {
		try {
			setResending(true)
			setError(null)
			const result = await pluginService.resendActivationEmail()
			setMessage(`Письмо с ссылкой активации отправлено на ${result.email}`)
		} catch {
			setError('Не удалось отправить письмо')
		} finally {
			setResending(false)
		}
	}

	return (
		<div className='rounded-xl border border-gray-200 bg-white p-4 space-y-3'>
			<h3 className='font-semibold text-black'>Плагин 3ds Max / Revit</h3>
			<p className='text-sm text-gray'>
				После оплаты на{' '}
				<span className='font-medium text-black'>{user.email}</span> приходит{' '}
				<strong>новая одноразовая ссылка</strong> (каждое письмо — другой хеш). Старые ссылки
				перестают работать. Вручную вставлять адрес хранилища не нужно.
			</p>
			<button
				type='button'
				onClick={resendEmail}
				disabled={resending}
				className='text-sm px-3 py-2 rounded-lg border border-main1 text-main1 hover:bg-main1 hover:text-white transition-colors disabled:opacity-50'
			>
				{resending ? 'Отправка…' : 'Отправить ссылку повторно'}
			</button>

			<div className='space-y-2 pt-2 border-t border-gray-100'>
				<label className='text-xs text-gray block'>Локальная папка с моделями (офлайн)</label>
				<input
					value={offlinePath}
					onChange={e => setOfflinePath(e.target.value)}
					placeholder='D:\project\sofa-marketplace'
					className='w-full px-3 py-2 rounded-lg border border-gray-200 font-mono text-sm'
				/>
				<p className='text-xs text-gray'>
					Плагин сначала ищет файл здесь (например Тумба0084.glb), затем скачивает из облака.
				</p>
				<label className='text-xs text-gray block'>Источник файлов</label>
				<select
					value={storageBackend}
					onChange={e =>
						setStorageBackend(
							e.target.value as 'vizhub_cloud' | 'local_first' | 'local_only'
						)
					}
					className='w-full px-3 py-2 rounded-lg border border-gray-200 text-sm'
				>
					<option value='local_first'>Сначала локально, затем облако</option>
					<option value='vizhub_cloud'>Только облако VizHub</option>
					<option value='local_only'>Только локальная папка</option>
				</select>
				<button
					type='button'
					onClick={saveSettings}
					disabled={saving}
					className='text-sm px-3 py-2 rounded-lg bg-main1 text-white hover:bg-main2 transition-colors disabled:opacity-50'
				>
					{saving ? 'Сохранение…' : 'Сохранить'}
				</button>
			</div>

			{message && <p className='text-sm text-green-700'>{message}</p>}
			{error && <p className='text-sm text-red-600'>{error}</p>}
		</div>
	)
}
