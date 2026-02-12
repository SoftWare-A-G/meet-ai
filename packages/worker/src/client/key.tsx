import { render } from 'hono/jsx/dom'
import KeyApp from './components/key/KeyApp'

const content = document.getElementById('content')
if (content) {
  render(<KeyApp />, content)
}
