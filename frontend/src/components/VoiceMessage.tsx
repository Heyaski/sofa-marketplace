'use client'

import { formatAudioDuration } from '@/utils/formatAudioDuration'
import { useEffect, useRef, useState } from 'react'

interface VoiceMessageProps {
	url: string
	duration: number
	isOwn: boolean
}

export default function VoiceMessage({
	url,
	duration,
	isOwn,
}: VoiceMessageProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const [playing, setPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [loadedDuration, setLoadedDuration] = useState(duration)

	const totalDuration = loadedDuration > 0 ? loadedDuration : duration
	const progress =
		totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0

	useEffect(() => {
		const audio = new Audio(url)
		audioRef.current = audio

		const onTimeUpdate = () => setCurrentTime(audio.currentTime)
		const onLoaded = () => {
			if (Number.isFinite(audio.duration) && audio.duration > 0) {
				setLoadedDuration(Math.round(audio.duration))
			}
		}
		const onEnded = () => {
			setPlaying(false)
			setCurrentTime(0)
		}
		const onPause = () => setPlaying(false)
		const onPlay = () => setPlaying(true)

		audio.addEventListener('timeupdate', onTimeUpdate)
		audio.addEventListener('loadedmetadata', onLoaded)
		audio.addEventListener('ended', onEnded)
		audio.addEventListener('pause', onPause)
		audio.addEventListener('play', onPlay)

		return () => {
			audio.pause()
			audio.removeEventListener('timeupdate', onTimeUpdate)
			audio.removeEventListener('loadedmetadata', onLoaded)
			audio.removeEventListener('ended', onEnded)
			audio.removeEventListener('pause', onPause)
			audio.removeEventListener('play', onPlay)
			audioRef.current = null
		}
	}, [url])

	const togglePlay = () => {
		const audio = audioRef.current
		if (!audio) return
		if (playing) {
			audio.pause()
		} else {
			void audio.play()
		}
	}

	const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
		const audio = audioRef.current
		if (!audio || !totalDuration) return
		const rect = e.currentTarget.getBoundingClientRect()
		const ratio = Math.max(
			0,
			Math.min(1, (e.clientX - rect.left) / rect.width)
		)
		audio.currentTime = ratio * totalDuration
		setCurrentTime(audio.currentTime)
	}

	const displayTime = playing
		? formatAudioDuration(currentTime)
		: formatAudioDuration(totalDuration)

	const barCount = 28

	return (
		<div className='flex items-center gap-2 min-w-[200px] max-w-[260px]'>
			<button
				type='button'
				onClick={togglePlay}
				className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
					isOwn
						? 'bg-white/20 hover:bg-white/30 text-white'
						: 'bg-main1/10 hover:bg-main1/20 text-main1'
				}`}
				aria-label={playing ? 'Пауза' : 'Воспроизвести'}
			>
				{playing ? (
					<svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
						<path d='M6 4h4v16H6V4zm8 0h4v16h-4V4z' />
					</svg>
				) : (
					<svg className='w-4 h-4 ml-0.5' fill='currentColor' viewBox='0 0 24 24'>
						<path d='M8 5v14l11-7z' />
					</svg>
				)}
			</button>

			<div className='flex-1 min-w-0'>
				<div
					className='flex items-end gap-[2px] h-6 cursor-pointer'
					onClick={handleSeek}
					role='slider'
					aria-valuenow={progress}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					{Array.from({ length: barCount }).map((_, i) => {
						const barProgress = (i / barCount) * 100
						const active = barProgress <= progress
						const height = 4 + ((i * 7) % 5) * 3
						return (
							<span
								key={i}
								className={`w-[3px] rounded-full transition-colors ${
									active
										? isOwn
											? 'bg-white'
											: 'bg-main1'
										: isOwn
											? 'bg-white/35'
											: 'bg-main1/25'
								}`}
								style={{ height }}
							/>
						)
					})}
				</div>
				<span
					className={`text-xs mt-0.5 block ${
						isOwn ? 'text-white/70' : 'text-gray'
					}`}
				>
					{displayTime}
				</span>
			</div>
		</div>
	)
}
