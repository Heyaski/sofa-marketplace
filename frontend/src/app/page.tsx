'use client'

import AuthModal from '@/components/AuthModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Home() {
	const router = useRouter()
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

	const handleAuthSuccess = () => {
		// После успешной авторизации закрываем модальное окно и перенаправляем в каталог
		setIsAuthModalOpen(false)
		router.push('/catalog')
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />
			<main>
				<HeroSection onOpenAuth={() => setIsAuthModalOpen(true)} />
			</main>
			<Footer />

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={handleAuthSuccess}
			/>
		</div>
	)
}
