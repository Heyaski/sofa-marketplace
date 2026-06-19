'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

type ArAppShellProps = {
	title: string
	backHref?: string
	children: ReactNode
}

export default function ArAppShell({ title, backHref, children }: ArAppShellProps) {
	return (
		<div className='min-h-[100dvh] bg-gray-bg flex flex-col'>
			<header className='sticky top-0 z-20 bg-white border-b border-gray2 pt-[env(safe-area-inset-top)]'>
				<div className='flex items-center gap-3 px-4 h-14 max-w-lg mx-auto w-full'>
					{backHref ? (
						<Link
							href={backHref}
							className='shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-main1 hover:bg-gray-bg'
							aria-label='Назад'
						>
							←
						</Link>
					) : (
						<span className='w-10' />
					)}
					<div className='flex-1 min-w-0 text-center'>
						<p className='text-xs text-gray leading-none'>VizHub</p>
						<h1 className='text-base font-semibold text-black truncate'>{title}</h1>
					</div>
					<Link
						href='/'
						className='shrink-0 text-xs text-gray hover:text-black px-2 py-1'
					>
						Сайт
					</Link>
				</div>
			</header>
			<main className='flex-1 w-full max-w-lg mx-auto pb-[env(safe-area-inset-bottom)]'>
				{children}
			</main>
		</div>
	)
}
