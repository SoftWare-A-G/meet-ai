import { BrowserWindow } from 'electrobun/bun'

export function showErrorScreen(message: string): void {
	const escaped = message
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')

	const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
	body {
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		background: #0f0f0f;
		color: #e0e0e0;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		margin: 0;
		padding: 24px;
		box-sizing: border-box;
	}
	.container {
		text-align: center;
		max-width: 400px;
	}
	h1 {
		font-size: 20px;
		color: #ff6b6b;
		margin-bottom: 16px;
	}
	p {
		font-size: 14px;
		line-height: 1.6;
		color: #aaa;
	}
	code {
		background: #1a1a2e;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 13px;
		color: #10b981;
	}
</style>
</head>
<body>
	<div class="container">
		<h1>Setup Required</h1>
		<p>${escaped}</p>
		<p style="margin-top: 24px;">Run:</p>
		<p><code>npm i -g @meet-ai/cli && meet-ai</code></p>
	</div>
</body>
</html>`

	new BrowserWindow({
		title: 'Meet AI - Setup Required',
		frame: { width: 500, height: 300, x: 200, y: 200 },
		html,
	})
}
