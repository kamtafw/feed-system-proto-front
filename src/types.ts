export interface User {
	id: string
	name: string
}
export interface Post {
	id: string
	author_id: string
	author_name: string
	content: string
	created_at: number
}

// Milestone 6 — cursor-based timeline pagination.
// next_cursor is OPAQUE from the frontend's perspective: store it, pass it
// back verbatim on the next request, never parse or construct it.
// See ADR-2 in docs/milestone-6-cursor-pagination.md.
export interface TimelinePage {
	posts: Post[]
	next_cursor: string | null
}

export interface AuthTokens {
	access_token: string
	refresh_token: string
	token_type: string
}

export interface AuthResponse extends AuthTokens {
	user: User
}

// personal WebSocket message (from /ws/{user_id})
export interface NewPostWSMessage {
	type: "NEW_POST"
	post_id: string
	author_id: string
	author_name: string
}

// system event types (broadcast channel — from /ws/events)
export type SystemEvent =
	| { event: "POST_CREATED"; post_id: string; author: string; content: string; ts: number }
	| { event: "FANOUT_START"; post_id: string; author: string; followers: string[]; ts: number }
	| { event: "FANOUT_WRITE"; target: string; post_id: string; ts: number }
	| { event: "REALTIME_START"; author: string; online: string[]; offline: string[]; ts: number }
	| { event: "REALTIME_SEND"; target: string; ts: number }
	| { event: "REALTIME_SKIP"; target: string; reason: string; ts: number }
