'use client'

import AuthModal from '@/components/AuthModal'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import { useState } from 'react'

export default function Home() {
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

	const handleAuthSuccess = () => {
		// После успешной авторизации просто закрываем модальное окно
		setIsAuthModalOpen(false)
		// Перезагружаем страницу, чтобы обновить Header с новой информацией о пользователе
		window.location.reload()
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
