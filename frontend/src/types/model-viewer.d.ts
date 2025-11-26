// Типы для @google/model-viewer web component
declare namespace JSX {
	interface IntrinsicElements {
		'model-viewer': {
			src: string
			alt?: string
			'camera-controls'?: boolean
			'auto-rotate'?: boolean
			ar?: boolean | string
			'shadow-intensity'?: string
			style?: React.CSSProperties
			onError?: (event: Event) => void
			[key: string]: any
		}
	}
}

