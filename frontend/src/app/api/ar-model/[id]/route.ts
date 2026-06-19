import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

type ProductPayload = {
	model_usdz?: string | null
	model_glb?: string | null
	asset_3d_models?: Array<{ file_url?: string; file_ext?: string }>
}

function pickModelUrl(product: ProductPayload, format: 'usdz' | 'glb'): string | null {
	const usdzCandidates: string[] = []
	const glbCandidates: string[] = []

	if (product.model_usdz?.trim()) usdzCandidates.push(product.model_usdz.trim())
	if (product.model_glb?.trim()) glbCandidates.push(product.model_glb.trim())

	for (const asset of product.asset_3d_models ?? []) {
		if (!asset.file_url?.trim()) continue
		const ext = (asset.file_ext || '').toLowerCase()
		const url = asset.file_url.trim()
		if (ext === 'usdz' || url.toLowerCase().split('?')[0].endsWith('.usdz')) {
			usdzCandidates.push(url)
		}
		if (['glb', 'gltf'].includes(ext) || /\.(glb|gltf)(\?|$)/i.test(url)) {
			glbCandidates.push(url)
		}
	}

	const absolutize = (raw: string) => {
		if (/^https?:\/\//i.test(raw)) return raw
		if (raw.startsWith('/')) return `${API_URL}${raw}`
		return `${API_URL}/media/${raw.replace(/^\//, '')}`
	}

	if (format === 'usdz') {
		const hit = usdzCandidates[0]
		return hit ? absolutize(hit) : null
	}
	const hit = glbCandidates[0]
	return hit ? absolutize(hit) : null
}

export async function GET(
	request: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	const { id } = await context.params
	const productId = Number(id)
	if (!Number.isFinite(productId) || productId <= 0) {
		return new Response('Invalid product id', { status: 400 })
	}

	const formatParam = request.nextUrl.searchParams.get('format')
	const format: 'usdz' | 'glb' = formatParam === 'glb' ? 'glb' : 'usdz'

	const productRes = await fetch(`${API_URL}/api/products/${productId}/`, {
		cache: 'no-store',
	})
	if (!productRes.ok) {
		return new Response('Product not found', { status: 404 })
	}

	const product = (await productRes.json()) as ProductPayload
	const modelUrl = pickModelUrl(product, format)
	if (!modelUrl) {
		return new Response(format === 'usdz' ? 'USDZ not available' : 'GLB not available', {
			status: 404,
		})
	}

	const modelRes = await fetch(modelUrl, { cache: 'no-store' })
	if (!modelRes.ok) {
		return new Response('Model fetch failed', { status: 502 })
	}

	const ext = modelUrl.toLowerCase().split('?')[0].split('.').pop()
	const contentType =
		ext === 'usdz'
			? 'model/vnd.usdz+zip'
			: ext === 'gltf'
				? 'model/gltf+json'
				: 'model/gltf-binary'

	return new Response(modelRes.body, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': 'inline',
			'Cache-Control': 'public, max-age=1800',
		},
	})
}
