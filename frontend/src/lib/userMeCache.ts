import type { User } from '@/types'

/** Короткий TTL: меньше дублирующих /api/users/me/ с шапки, футера, каталога за один визит. */
const ME_TTL_MS = 20_000

let cache: { user: User; expires: number } | null = null
let inFlight: Promise<User> | null = null

export function clearUserMeCache(): void {
	cache = null
	inFlight = null
}

/**
 * Один запрос в полёте + кэш на TTL — убирает «рваное» UI от пачки параллельных /me/.
 */
export async function getCachedCurrentUser(fetchMe: () => Promise<User>): Promise<User> {
	if (typeof window !== 'undefined' && !localStorage.getItem('access_token')) {
		clearUserMeCache()
	}

	const now = Date.now()
	if (cache && cache.expires > now) {
		return cache.user
	}
	if (inFlight) {
		return inFlight
	}

	inFlight = (async () => {
		try {
			const user = await fetchMe()
			cache = { user, expires: Date.now() + ME_TTL_MS }
			return user
		} catch (e) {
			clearUserMeCache()
			throw e
		} finally {
			inFlight = null
		}
	})()

	return inFlight
}
