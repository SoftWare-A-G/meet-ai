import { showErrorOverlay, installErrorHandlers } from './ErrorOverlay'
import { createGame } from './bootstrap'

installErrorHandlers()

function boot() {
	try {
		createGame()
	} catch (error) {
		showErrorOverlay(error)
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot)
} else {
	boot()
}
