import { Suspense } from 'react'
import ProfilePageClient from './ProfilePageClient'

function ProfileLoadingFallback() {
	return (
		<div className='min-h-screen bg-gray-bg flex items-center justify-center'>
			<div className='text-center'>
				<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-main1 mx-auto' />
				<p className='mt-4 text-gray'>Загрузка...</p>
			</div>
		</div>
	)
}

export default function ProfilePage() {
	return (
		<Suspense fallback={<ProfileLoadingFallback />}>
			<ProfilePageClient />
		</Suspense>
	)
}
