/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/components/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/app/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			colors: {
				// Custom color palette from Figma
				black: '#111010',
				white: '#FFFFFF',
				'gray-bg': '#F2F3F7',
				gray: '#B1ABAB',
				gray2: '#D6D5D4',
				main1: '#1976D2',
				main2: '#2819D2',
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
			},
			spacing: {
				18: '4.5rem',
				88: '22rem',
			},
			borderRadius: {
				xl: '1rem',
			},
			boxShadow: {
				card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
			},
		},
	},
	plugins: [],
}


