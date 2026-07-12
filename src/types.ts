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

// personal WS message (from /ws/{user_id})
export interface NewPostWSMessage {
	type: "NEW_POST"
	post_id: string
	author_id: string
	author_name: string
}

// system event types (from /ws/events)
export type SystemEvent =
	| { event: "POST_CREATED"; post_id: string; author: string; content: string; ts: number }
	| { event: "FANOUT_START"; post_id: string; author: string; followers: string[]; ts: number }
	| { event: "FANOUT_WRITE"; target: string; post_id: string; ts: number }
	| { event: "REALTIME_START"; author: string; online: string[]; offline: string[]; ts: number }
	| { event: "REALTIME_SEND"; target: string; ts: number }
	| { event: "REALTIME_SKIP"; target: string; reason: string; ts: number }
