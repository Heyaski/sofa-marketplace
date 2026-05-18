/**
 * /api/downloads/presign/ с OptionalJWT на бэкенде: истёкший токен → AnonymousUser → 403 от IsAuthenticated,
 * а не 401. Разделяем «нужна авторизация» и «достигнут лимит скачиваний» (тоже 403).
 */

export function clearStoredAuthTokens(): void {
	try {
		localStorage.removeItem('access_token')
		localStorage.removeItem('refresh_token')
	} catch {
		/* ignore */
	}
}

export type PresignErrorBody = {
	error?: string
	detail?: string
	message?: string
} | null

/**
 * @returns true если обработано (вызывающему не нужен общий alert)
 */
export function handlePresignFailure(
	status: number,
	data: PresignErrorBody,
	onAuthRequired: () => void,
	onShowLimitMessage: (msg: string) => void
): boolean {
	if (status === 401) {
		clearStoredAuthTokens()
		onAuthRequired()
		return true
	}
	if (status === 403) {
		const err = (data?.error && String(data.error)) || ''
		const limitHit =
			err.includes('лимит') ||
			err.includes('Достигнут лимит') ||
			err.includes('скачиваний')
		if (limitHit) {
			onShowLimitMessage(
				err ||
					(data?.detail && String(data.detail)) ||
					'Достигнут лимит скачиваний для вашей подписки.'
			)
			return true
		}
		clearStoredAuthTokens()
		onAuthRequired()
		return true
	}
	return false
}
