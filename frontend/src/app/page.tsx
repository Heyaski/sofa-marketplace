'use client'

import AuthModal from '@/components/AuthModal'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import TariffTable from '@/components/TariffTable'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Home() {
	const router = useRouter()
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

	const handleAuthSuccess = () => {
		setIsAuthModalOpen(false)
		router.push('/catalog')
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />
			<main className='pb-20 lg:pb-0'>
				<HeroSection onOpenAuth={() => setIsAuthModalOpen(true)} />
				<TariffTable />
			</main>
			<Footer />
			<BottomNav />

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={handleAuthSuccess}
			/>
		</div>
	)
}
