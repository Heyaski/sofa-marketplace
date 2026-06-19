import ArAppProductViewClient from './ArAppProductViewClient'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: { id: string }
}

export default function ArAppProductViewPage({ params }: PageProps) {
	const productId = parseInt(params.id, 10)
	return <ArAppProductViewClient productId={productId} />
}
