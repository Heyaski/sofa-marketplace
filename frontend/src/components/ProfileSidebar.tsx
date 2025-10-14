'use client'

import {
	ChatBubbleLeftRightIcon,
	CreditCardIcon,
	FolderIcon,
	ShoppingCartIcon,
	UserIcon,
} from '@heroicons/react/24/outline'

interface ProfileSidebarProps {
	activeTab: string
	onTabChange: (tab: string) => void
}

export default function ProfileSidebar({
	activeTab,
	onTabChange,
}: ProfileSidebarProps) {
	const menuItems = [
		{
			id: 'profile',
			label: 'Профиль',
			icon: UserIcon,
		},
		{
			id: 'subscription',
			label: 'Подписка',
			icon: CreditCardIcon,
		},
		{
			id: 'downloads',
			label: 'История загрузок',
			icon: FolderIcon,
		},
		{
			id: 'cart',
			label: 'Корзина / проекты',
			icon: ShoppingCartIcon,
		},
		{
			id: 'chats',
			label: 'Чаты',
			icon: ChatBubbleLeftRightIcon,
		},
	]

	return (
		<div className='w-64 bg-white rounded-xl shadow-card p-6 h-fit'>
			<nav className='space-y-2'>
				{menuItems.map(item => {
					const Icon = item.icon
					const isActive = activeTab === item.id

					return (
						<button
							key={item.id}
							onClick={() => onTabChange(item.id)}
							className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
								isActive ? 'bg-main1 text-white' : 'text-gray hover:bg-gray-bg'
							}`}
						>
							<Icon className='w-5 h-5' />
							<span className='text-sm font-medium'>{item.label}</span>
						</button>
					)
				})}
			</nav>
		</div>
	)
}
