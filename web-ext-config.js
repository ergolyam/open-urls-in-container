const fs = require('fs')
const path = require('path')

const manifestPath = path.join(__dirname, 'src', 'extension', 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const version = manifest.version || '0.0.0'

module.exports = {
	// Global options:
	sourceDir: 'build/webpack',

	// Command options:
	build: {
		overwriteDest: true,
		filename: `open_urls_in_container-${version}.xpi`,
	},
}
