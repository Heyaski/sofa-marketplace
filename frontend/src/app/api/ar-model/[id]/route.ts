import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

/** Same-origin прокси: USDZ для iPhone AR (генерируется из GLB на бэкенде). */
export async function GET(
	request: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	const { id } = await context.params
	const productId = Number(id)
	if (!Number.isFinite(productId) || productId <= 0) {
		return new Response('Invalid product id', { status: 400 })
	}

	const format = request.nextUrl.searchParams.get('format')
	if (format === 'glb') {
		const productRes = await fetch(`${API_URL}/api/products/${productId}/`, { cache: 'no-store' })
		if (!productRes.ok) return new Response('Product not found', { status: 404 })
		const product = (await productRes.json()) as { model_glb?: string }
		const glb = product.model_glb?.trim()
		if (!glb) return new Response('GLB not available', { status: 404 })
		const glbUrl = /^https?:\/\//i.test(glb) ? glb : `${API_URL}${glb.startsWith('/') ? '' : '/media/'}${glb.replace(/^\//, '')}`
		const modelRes = await fetch(glbUrl, { cache: 'no-store' })
		if (!modelRes.ok) return new Response('Model fetch failed', { status: 502 })
		return new Response(modelRes.body, {
			headers: {
				'Content-Type': 'model/gltf-binary',
				'Content-Disposition': 'inline',
				'Cache-Control': 'public, max-age=1800',
			},
		})
	}

	const usdzRes = await fetch(`${API_URL}/api/products/${productId}/ar-usdz/`, {
		cache: 'no-store',
		signal: AbortSignal.timeout(10 * 60 * 1000),
	})
	if (!usdzRes.ok) {
		const text = await usdzRes.text().catch(() => '')
		return new Response(text || 'AR model not ready', { status: usdzRes.status })
	}

	const payload = await usdzRes.arrayBuffer()
	if (payload.byteLength < 128) {
		return new Response('AR model empty', { status: 502 })
	}

	return new Response(payload, {
		status: 200,
		headers: {
			'Content-Type': 'model/vnd.usdz+zip',
			'Content-Disposition': 'inline; filename="model.usdz"',
			'Cache-Control': 'public, max-age=1800',
		},
	})
}
