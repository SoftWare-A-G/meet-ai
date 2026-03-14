import type { MeetAiEvent } from '../bun/meetai-client'

// ─── RPC Schema ───
// Single source of truth for the Electrobun RPC contract between bun and webview.
// bun.messages = messages the bun process sends TO the webview

export type MeetAiRPCSchema = {
	bun: {
		requests: {}
		messages: {
			'meetai:team_info': Extract<MeetAiEvent, { type: 'team_info' }>
			'meetai:message': Extract<MeetAiEvent, { type: 'message' }>
			'meetai:tasks_info': Extract<MeetAiEvent, { type: 'tasks_info' }>
			'meetai:log': Extract<MeetAiEvent, { type: 'log' }>
			'meetai:commands_info': Extract<MeetAiEvent, { type: 'commands_info' }>
		}
	}
	webview: {
		requests: {}
		messages: {}
	}
}
