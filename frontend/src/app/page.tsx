'use client'

import AuthModal from '@/components/AuthModal'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import HeroSection from '@/components/HeroSection'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
	const router = useRouter()
	const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
	const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
	const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | undefined>(undefined)

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const modeParam = params.get('auth')
		const nextParam = params.get('next')
		if (modeParam === 'register' || modeParam === 'login') {
			setAuthMode(modeParam)
			setRedirectAfterAuth(nextParam || undefined)
			setIsAuthModalOpen(true)
		}
	}, [])

	const handleAuthSuccess = () => {
		setIsAuthModalOpen(false)
		router.push('/catalog')
	}

	return (
		<div className='min-h-screen bg-gray-bg'>
			<Header />
			<main className='pb-20 lg:pb-0'>
				<HeroSection onOpenAuth={() => setIsAuthModalOpen(true)} />
			</main>
			<Footer />
			<BottomNav />

			<AuthModal
				isOpen={isAuthModalOpen}
				onClose={() => setIsAuthModalOpen(false)}
				onSuccess={handleAuthSuccess}
				initialMode={authMode}
				redirectAfterAuth={redirectAfterAuth}
			/>
		</div>
	)
}
