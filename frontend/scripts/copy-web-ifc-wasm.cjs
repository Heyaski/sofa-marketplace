'use strict'

const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'node_modules', 'web-ifc')
const destDir = path.join(root, 'public', 'web-ifc')

if (!fs.existsSync(srcDir)) {
	console.warn('[copy-web-ifc-wasm] node_modules/web-ifc not found; run npm install in frontend/')
	process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
for (const f of ['web-ifc.wasm', 'web-ifc-mt.wasm']) {
	const from = path.join(srcDir, f)
	const to = path.join(destDir, f)
	if (!fs.existsSync(from)) {
		console.warn('[copy-web-ifc-wasm] missing', from)
		continue
	}
	fs.copyFileSync(from, to)
}
console.log('[copy-web-ifc-wasm] copied .wasm to public/web-ifc/')
