import { showErrorOverlay, installErrorHandlers } from './ErrorOverlay'
import { createGame } from './bootstrap'

installErrorHandlers()

try {
	createGame()
} catch (err) {
	showErrorOverlay(err)
}
