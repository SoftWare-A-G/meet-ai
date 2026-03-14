import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "meet-ai",
		identifier: "meet-ai.electrobun.dev",
		version: "0.0.1",
	},
	build: {
		useAsar: false,
		bun: {
			entrypoint: "src/bun/index.ts",
		},
		views: {
			mainview: {
				entrypoint: "src/mainview/index.ts",
			},
		},
		copy: {
			"src/mainview/index.html": "views/mainview/index.html",
			"src/mainview/index.css": "views/mainview/index.css",
			"src/assets": "assets",
		},
		mac: {
			bundleCEF: true,
			bundleWGPU: true,
		},
		linux: {
			bundleCEF: true,
			bundleWGPU: true,
		},
		win: {
			bundleCEF: true,
			bundleWGPU: true,
		},
	},
} satisfies ElectrobunConfig;
