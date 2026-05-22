'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function getSupportedMimeType(): string {
	if (typeof MediaRecorder === 'undefined') return ''
	const types = [
		'audio/webm;codecs=opus',
		'audio/webm',
		'audio/ogg;codecs=opus',
		'audio/mp4',
	]
	for (const type of types) {
		if (MediaRecorder.isTypeSupported(type)) return type
	}
	return ''
}

export function useVoiceRecorder() {
	const [isRecording, setIsRecording] = useState(false)
	const [duration, setDuration] = useState(0)
	const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const mediaRecorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const streamRef = useRef<MediaStream | null>(null)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const mimeTypeRef = useRef('')

	const clearPreview = useCallback(() => {
		if (previewUrl) URL.revokeObjectURL(previewUrl)
		setPreviewBlob(null)
		setPreviewUrl(null)
		setDuration(0)
	}, [previewUrl])

	const stopStream = useCallback(() => {
		streamRef.current?.getTracks().forEach(track => track.stop())
		streamRef.current = null
	}, [])

	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
	}, [])

	useEffect(() => {
		return () => {
			stopTimer()
			stopStream()
			if (previewUrl) URL.revokeObjectURL(previewUrl)
		}
	}, [previewUrl, stopStream, stopTimer])

	const startRecording = useCallback(async () => {
		setError(null)
		clearPreview()

		if (!navigator.mediaDevices?.getUserMedia) {
			setError('Запись голоса не поддерживается в этом браузере')
			return
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			streamRef.current = stream
			chunksRef.current = []

			const mimeType = getSupportedMimeType()
			mimeTypeRef.current = mimeType
			const recorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream)

			mediaRecorderRef.current = recorder

			recorder.ondataavailable = e => {
				if (e.data.size > 0) chunksRef.current.push(e.data)
			}

			recorder.onstop = () => {
				stopTimer()
				stopStream()
				const blob = new Blob(chunksRef.current, {
					type: mimeTypeRef.current || 'audio/webm',
				})
				if (blob.size > 0) {
					setPreviewBlob(blob)
					setPreviewUrl(URL.createObjectURL(blob))
				}
				setIsRecording(false)
			}

			recorder.start(200)
			setIsRecording(true)
			setDuration(0)
			const startedAt = Date.now()
			timerRef.current = setInterval(() => {
				setDuration(Math.floor((Date.now() - startedAt) / 1000))
			}, 200)
		} catch {
			setError('Не удалось получить доступ к микрофону')
			stopStream()
		}
	}, [clearPreview, stopStream, stopTimer])

	const stopRecording = useCallback(() => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== 'inactive'
		) {
			mediaRecorderRef.current.stop()
		} else {
			setIsRecording(false)
			stopTimer()
			stopStream()
		}
	}, [stopStream, stopTimer])

	const cancelRecording = useCallback(() => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== 'inactive'
		) {
			mediaRecorderRef.current.onstop = null
			mediaRecorderRef.current.stop()
		}
		chunksRef.current = []
		setIsRecording(false)
		stopTimer()
		stopStream()
		clearPreview()
	}, [clearPreview, stopStream, stopTimer])

	const getFileForUpload = useCallback((): File | null => {
		if (!previewBlob) return null
		const ext = previewBlob.type.includes('ogg')
			? 'ogg'
			: previewBlob.type.includes('mp4')
				? 'm4a'
				: 'webm'
		return new File([previewBlob], `voice.${ext}`, { type: previewBlob.type })
	}, [previewBlob])

	return {
		isRecording,
		duration,
		previewBlob,
		previewUrl,
		error,
		startRecording,
		stopRecording,
		cancelRecording,
		clearPreview,
		getFileForUpload,
	}
}
