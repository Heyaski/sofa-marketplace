import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

/** Прокси USDZ с same-origin (для rel="ar" на iPhone). */
export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ productId: string }> }
) {
	const { productId } = await context.params
	const id = Number(productId)
	if (!Number.isFinite(id) || id <= 0) {
		return new Response('Invalid product id', { status: 400 })
	}

	const upstream = await fetch(`${API_URL}/api/products/${id}/ar-usdz/`, {
		cache: 'no-store',
		redirect: 'manual',
	})

	if (upstream.status >= 300 && upstream.status < 400) {
		const location = upstream.headers.get('location')
		if (location) {
			const fileRes = await fetch(location, { cache: 'no-store' })
			if (!fileRes.ok) {
				return new Response('USDZ fetch failed', { status: 502 })
			}
			const payload = await fileRes.arrayBuffer()
			return new NextResponse(payload, {
				status: 200,
				headers: {
					'Content-Type': 'model/vnd.usdz+zip',
					'Content-Disposition': 'inline; filename="model.usdz"',
					'Cache-Control': 'public, max-age=1800',
					'Content-Length': String(payload.byteLength),
				},
			})
		}
	}

	if (!upstream.ok) {
		const text = await upstream.text().catch(() => '')
		return new Response(text || 'AR model not ready', { status: upstream.status })
	}

	const payload = await upstream.arrayBuffer()
	return new NextResponse(payload, {
		status: 200,
		headers: {
			'Content-Type': 'model/vnd.usdz+zip',
			'Content-Disposition': 'inline; filename="model.usdz"',
			'Cache-Control': 'public, max-age=1800',
			'Content-Length': String(payload.byteLength),
		},
	})
}

export async function HEAD(
	request: NextRequest,
	context: { params: Promise<{ productId: string }> }
) {
	const response = await GET(request, context)
	return new Response(null, {
		status: response.status,
		headers: response.headers,
	})
}
