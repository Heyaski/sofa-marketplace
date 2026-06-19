import ArAppProductClient from './ArAppProductClient'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: { id: string }
}

export default function ArAppProductPage({ params }: PageProps) {
	const productId = parseInt(params.id, 10)
	return <ArAppProductClient productId={productId} />
}
