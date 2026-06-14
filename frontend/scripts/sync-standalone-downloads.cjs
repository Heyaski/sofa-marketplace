/**
 * Standalone-сборка копирует public/ только на этапе build.
 * APK кладётся после сборки — делаем symlink downloads → ../../public/downloads.
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const standalonePublic = path.join(root, '.next', 'standalone', 'public')
const srcDownloads = path.join(root, 'public', 'downloads')
const linkDownloads = path.join(standalonePublic, 'downloads')

if (!fs.existsSync(path.join(root, '.next', 'standalone'))) {
	console.log('[sync-standalone-downloads] standalone not found, skip')
	process.exit(0)
}

fs.mkdirSync(standalonePublic, { recursive: true })
fs.mkdirSync(srcDownloads, { recursive: true })

try {
	fs.rmSync(linkDownloads, { recursive: true, force: true })
} catch {
	/* ignore */
}

const relativeTarget = path.relative(standalonePublic, srcDownloads)
fs.symlinkSync(relativeTarget, linkDownloads, 'dir')
console.log('[sync-standalone-downloads] linked', linkDownloads, '->', relativeTarget)
