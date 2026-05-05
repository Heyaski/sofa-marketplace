'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { IFCLoader } from 'web-ifc-three'

/** WASM web-ifc кладутся в `public/web-ifc` скриптом postinstall (см. scripts/copy-web-ifc-wasm.cjs). */
const WASM_ROOT = '/web-ifc/'

interface IfcModelViewerProps {
	ifcUrl: string
	className?: string
}

export default function IfcModelViewer({ ifcUrl, className = '' }: IfcModelViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const loaderRef = useRef<InstanceType<typeof IFCLoader> | null>(null)
	const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
	const controlsRef = useRef<InstanceType<typeof OrbitControls> | null>(null)
	const resizeRef = useRef<(() => void) | null>(null)
	const rafRef = useRef<number>(0)
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [errorText, setErrorText] = useState<string | null>(null)

	useEffect(() => {
		const mount = containerRef.current
		if (!mount || !ifcUrl) return

		let disposed = false

		void (async () => {
			setStatus('loading')
			setErrorText(null)

			const scene = new THREE.Scene()
			scene.background = new THREE.Color(0xf3f4f6)

			const rw0 = Math.max(mount.clientWidth, 160)
			const rh0 = Math.max(mount.clientHeight || 160, 160)
			const aspect = rw0 / rh0
			const camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 5_000_000)
			camera.position.set(12, 12, 12)

			const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
			renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2))
			renderer.setSize(rw0, rh0)
			rendererRef.current = renderer
			mount.innerHTML = ''
			mount.appendChild(renderer.domElement)

			const controls = new OrbitControls(camera, renderer.domElement)
			controls.enableDamping = true
			controlsRef.current = controls

			scene.add(new THREE.AmbientLight(0xffffff, 0.82))
			const dir = new THREE.DirectionalLight(0xffffff, 0.95)
			dir.position.set(30, 50, 24)
			scene.add(dir)

			const onResize = () => {
				if (disposed || !mount || !rendererRef.current) return
				const w = Math.max(mount.clientWidth, 160)
				const h = Math.max(mount.clientHeight || 160, 160)
				camera.aspect = w / h
				camera.updateProjectionMatrix()
				rendererRef.current.setSize(w, h)
			}
			resizeRef.current = onResize
			window.addEventListener('resize', onResize)

			const loop = () => {
				if (disposed || !rendererRef.current || !controlsRef.current) return
				rafRef.current = requestAnimationFrame(loop)
				controlsRef.current.update()
				rendererRef.current.render(scene, camera)
			}
			loop()

			try {
				const loader = new IFCLoader()
				loaderRef.current = loader
				await loader.ifcManager.setWasmPath(WASM_ROOT)

				await new Promise<void>((resolve, reject) => {
					loader.load(
						ifcUrl,
						(group) => {
							try {
								if (disposed) {
									resolve()
									return
								}
								scene.add(group)
								const box = new THREE.Box3().setFromObject(group)
								const center = box.getCenter(new THREE.Vector3())
								const size = box.getSize(new THREE.Vector3())
								const maxDim = Math.max(size.x, size.y, size.z, 0.001)
								const dist = maxDim * 2.8
								const c = controlsRef.current
								if (c) c.target.copy(center)
								camera.position.set(center.x + dist, center.y + dist * 0.35, center.z + dist)
								camera.near = maxDim / 2000
								camera.far = maxDim * 200
								camera.updateProjectionMatrix()
								c?.update()
								resolve()
							} catch (err) {
								reject(err)
							}
						},
						undefined,
						(err: unknown) => reject(err instanceof Error ? err : new Error(String(err)))
					)
				})
				if (!disposed) setStatus('ready')
			} catch (e) {
				if (!disposed) {
					setStatus('error')
					setErrorText(e instanceof Error ? e.message : 'Не удалось открыть IFC')
				}
			}
		})()

		return () => {
			disposed = true
			cancelAnimationFrame(rafRef.current)
			if (resizeRef.current) {
				window.removeEventListener('resize', resizeRef.current)
				resizeRef.current = null
			}
			void loaderRef.current?.ifcManager?.dispose?.().catch(() => {})
			loaderRef.current = null
			controlsRef.current = null
			if (rendererRef.current) {
				rendererRef.current.dispose()
				rendererRef.current = null
			}
			if (mount) mount.innerHTML = ''
		}
	}, [ifcUrl])

	return (
		<div className={`relative w-full overflow-hidden rounded-lg bg-gray-50 ${className}`}>
			<div
				ref={containerRef}
				className='w-full min-h-[180px] max-h-[300px] aspect-square sm:aspect-auto sm:min-h-[200px]'
			/>
			{status === 'loading' && (
				<div className='pointer-events-none absolute inset-0 flex items-center justify-center bg-gray-50/80'>
					<div className='flex flex-col items-center gap-2'>
						<div className='h-8 w-8 animate-spin rounded-full border-2 border-main1 border-t-transparent' />
						<span className='text-xs text-gray'>Загрузка IFC…</span>
					</div>
				</div>
			)}
			{status === 'error' && errorText && (
				<div className='absolute inset-0 flex items-center justify-center bg-gray-50 p-2 text-center text-xs text-gray'>
					{errorText}
				</div>
			)}
		</div>
	)
}
