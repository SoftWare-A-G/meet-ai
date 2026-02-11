import { render } from 'hono/jsx/dom'
import ChatApp from './components/ChatApp'

const root = document.getElementById('root')
if (root) {
  render(<ChatApp />, root)
}
