'use client'

import { useEffect, useRef, useState } from 'react'

type ArFbxViewerProps = {
	url: string
}

export default function ArFbxViewer({ url }: ArFbxViewerProps) {
	const mountRef = useRef<HTMLDivElement>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const mount = mountRef.current
		if (!mount) return

		let cancelled = false
		let animationId = 0
		let renderer: import('three').WebGLRenderer | null = null

		const run = async () => {
			try {
				const THREE = await import('three')
				const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
				const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')

				if (cancelled || !mountRef.current) return

				const width = mount.clientWidth || 320
				const height = mount.clientHeight || 360

				const scene = new THREE.Scene()
				scene.background = new THREE.Color(0xf3f4f6)

				const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000)
				camera.position.set(2, 1.5, 2.5)

				renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
				renderer.setSize(width, height)
				renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
				mount.appendChild(renderer.domElement)

				const controls = new OrbitControls(camera, renderer.domElement)
				controls.enableDamping = true
				controls.target.set(0, 0.5, 0)

				scene.add(new THREE.AmbientLight(0xffffff, 0.85))
				const dir = new THREE.DirectionalLight(0xffffff, 1.1)
				dir.position.set(4, 8, 6)
				scene.add(dir)

				const object = await new FBXLoader().loadAsync(url)
				if (cancelled) return

				const box = new THREE.Box3().setFromObject(object)
				const size = box.getSize(new THREE.Vector3())
				const center = box.getCenter(new THREE.Vector3())
				object.position.sub(center)
				const maxDim = Math.max(size.x, size.y, size.z, 0.001)
				const scale = 1.6 / maxDim
				object.scale.setScalar(scale)
				object.position.y += (size.y * scale) / 2
				scene.add(object)

				const animate = () => {
					if (cancelled) return
					animationId = requestAnimationFrame(animate)
					controls.update()
					renderer?.render(scene, camera)
				}
				animate()
				setLoading(false)
			} catch {
				if (!cancelled) {
					setError('Не удалось загрузить FBX-модель')
					setLoading(false)
				}
			}
		}

		void run()

		return () => {
			cancelled = true
			cancelAnimationFrame(animationId)
			if (renderer) {
				renderer.dispose()
				renderer.domElement.remove()
			}
			mount.innerHTML = ''
		}
	}, [url])

	if (error) {
		return (
			<p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4'>
				{error}
			</p>
		)
	}

	return (
		<div className='space-y-3'>
			<div
				ref={mountRef}
				className='relative w-full rounded-xl overflow-hidden bg-gray-bg'
				style={{ height: 'min(60vh, 420px)', minHeight: 280 }}
			>
				{loading ? (
					<div className='absolute inset-0 flex items-center justify-center'>
						<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-main1' />
					</div>
				) : null}
			</div>
			<p className='text-xs text-gray text-center'>
				FBX: поворот и масштаб пальцами. Для AR в комнате нужен GLB — он открывается с кнопкой AR.
			</p>
		</div>
	)
}
