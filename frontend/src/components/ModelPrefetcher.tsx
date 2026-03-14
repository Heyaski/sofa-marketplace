'use client'

import { useEffect } from 'react'
import { prefetchFirstModels } from '@/lib/modelPrefetch'

export default function ModelPrefetcher() {
	useEffect(() => {
		prefetchFirstModels()
	}, [])
	return null
}
