/**
 * Кэш GLB: память (сессия) + Cache API (перезагрузка страницы).
 * Ключ — путь объекта на S3 без query (presigned меняется, путь — нет).
 */

export const GLB_CACHE_NAME = 'vizhub-glb-models-v2'
const MEMORY_MAX_ENTRIES = 48
const CACHE_REQUEST_ORIGIN = 'https://glb-cache.vizhub.local'

const memoryBlobUrls = new Map<string, string>()
const memoryOrder: string[] = []
const inflight = new Map<string, Promise<string>>()

/** Стабильный ключ кэша (pathname S3 / media). */
export function getStableGlbCacheKey(url: string): string | null {
	try {
		const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://local/')
		const path = decodeURIComponent(parsed.pathname).toLowerCase()
		if (!path || path === '/') return null
		return path
	} catch {
		return null
	}
}

function cacheRequestForKey(key: string): Request {
	const path = key.startsWith('/') ? key.slice(1) : key
	return new Request(`${CACHE_REQUEST_ORIGIN}/${path}`)
}

function touchMemory(key: string, blobUrl: string): void {
	if (memoryBlobUrls.has(key)) {
		const idx = memoryOrder.indexOf(key)
		if (idx >= 0) memoryOrder.splice(idx, 1)
	} else if (memoryOrder.length >= MEMORY_MAX_ENTRIES) {
		const evict = memoryOrder.shift()
		if (evict) {
			const old = memoryBlobUrls.get(evict)
			if (old) URL.revokeObjectURL(old)
			memoryBlobUrls.delete(evict)
		}
	}
	memoryBlobUrls.set(key, blobUrl)
	memoryOrder.push(key)
}

/** Мгновенно: уже в RAM (повторное открытие карточки / скролл назад). */
export function peekGlbBlobUrl(networkUrl: string): string | null {
	const key = getStableGlbCacheKey(networkUrl)
	if (!key) return null
	return memoryBlobUrls.get(key) ?? null
}

async function readFromCacheApi(key: string): Promise<Blob | null> {
	if (typeof caches === 'undefined') return null
	try {
		const cache = await caches.open(GLB_CACHE_NAME)
		const hit = await cache.match(cacheRequestForKey(key))
		if (!hit) return null
		return await hit.blob()
	} catch {
		return null
	}
}

async function writeToCacheApi(key: string, blob: Blob): Promise<void> {
	if (typeof caches === 'undefined') return
	try {
		const cache = await caches.open(GLB_CACHE_NAME)
		await cache.put(
			cacheRequestForKey(key),
			new Response(blob, {
				headers: { 'Content-Type': 'model/gltf-binary' },
			})
		)
	} catch {
		/* ignore quota / private mode */
	}
}

function blobToSrc(key: string, blob: Blob): string {
	const blobUrl = URL.createObjectURL(blob)
	touchMemory(key, blobUrl)
	return blobUrl
}

/**
 * URL для model-viewer: blob из кэша или сеть + сохранение.
 * При ошибке кэша — исходный network URL.
 */
export async function resolveGlbModelSrc(networkUrl: string): Promise<string> {
	const key = getStableGlbCacheKey(networkUrl)
	if (!key) return networkUrl

	const mem = memoryBlobUrls.get(key)
	if (mem) return mem

	const existing = inflight.get(key)
	if (existing) return existing

	const task = (async () => {
		const cachedBlob = await readFromCacheApi(key)
		if (cachedBlob && cachedBlob.size > 0) {
			return blobToSrc(key, cachedBlob)
		}

		const res = await fetch(networkUrl, { mode: 'cors', credentials: 'omit' })
		if (!res.ok) return networkUrl

		const blob = await res.blob()
		if (!blob.size) return networkUrl

		void writeToCacheApi(key, blob)
		return blobToSrc(key, blob)
	})()
		.catch(() => networkUrl)
		.finally(() => {
			inflight.delete(key)
		})

	inflight.set(key, task)
	return task
}

/** Фоновая подгрузка в кэш (каталог / prefetch). */
export function prefetchGlbModel(networkUrl: string): void {
	const key = getStableGlbCacheKey(networkUrl)
	if (!key || memoryBlobUrls.has(key)) return
	if (inflight.has(key)) return
	void resolveGlbModelSrc(networkUrl)
}

export function prefetchGlbModels(networkUrls: Iterable<string>): void {
	for (const url of networkUrls) {
		if (url) prefetchGlbModel(url)
	}
}
