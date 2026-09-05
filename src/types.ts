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

// personal WebSocket message (from /ws/feed)
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
	| { event: "FANOUT_HEAVY"; post_id: string; author: string; follower_count: number; ts: number }
	| { event: "REALTIME_START"; author: string; online: string[]; offline: string[]; ts: number }
	| { event: "REALTIME_SEND"; target: string; ts: number }
	| { event: "REALTIME_SKIP"; target: string; reason: string; ts: number }

// ─────────────────────────────────────────────────────────────────────────
// Milestone 8 — persistent notifications (REST representation).
// This is the AUTHORITATIVE shape: what GET /notifications actually
// returns. Postgres, via these endpoints, is the only source of truth
// for notification existence and read state — never the WS hint below.
// ─────────────────────────────────────────────────────────────────────────
export interface Notification {
	id: number
	recipient_id: string
	actor_id: string
	type: "NEW_POST" | "NEW_FOLLOWER"
	object_type: string
	object_id: string
	created_at: number
	read_at: number | null
}

// next_cursor is opaque here too, same discipline as TimelinePage above —
// encoded server-side as "{created_at}:{id}", never parsed on the frontend.
export interface NotificationPage {
	notifications: Notification[]
	next_cursor: string | null
}

// ─────────────────────────────────────────────────────────────────────────
// Milestone 8.5 — the live NEW_NOTIFICATION WebSocket hint.
// Deliberately NOT the same shape as Notification above: no id,
// created_at, or read_at. This is a best-effort, non-authoritative
// signal — "something happened, go check" — not a delta to apply to
// loaded notification state. Keeping the two interfaces visibly
// different (rather than e.g. Partial<Notification>) is what makes "never
// derive authoritative state from this payload" a type-level fact, not
// just a convention someone has to remember. See
// src/notification-hint.js and
// docs/milestone-8.5-realtime-notification-hint.md.
// ─────────────────────────────────────────────────────────────────────────
export interface NotificationHintWSMessage {
	type: "NEW_NOTIFICATION"
	notification_type: "NEW_POST" | "NEW_FOLLOWER"
	actor_id: string
	actor_name: string
	object_type: string
	object_id: string
}

// Every message shape that can arrive over the /ws/feed connection.
export type FeedWSMessage = NewPostWSMessage | NotificationHintWSMessage
