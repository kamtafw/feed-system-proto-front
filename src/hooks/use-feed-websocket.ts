/* eslint-disable react-hooks/refs */
/**
 * useFeedWebSocket — personal feed WebSocket channel.
 *
 * Milestone 8.5 added branching on NEW_NOTIFICATION, the best-effort
 * live hint from app/notifications.py's notify_new_post_hint /
 * notify_new_follower_hint. Both message types arrive on this SAME
 * connection — no second socket, no new WS route. isNotificationHint()
 * comes from src/notification-hint.js, the single place the
 * NEW_NOTIFICATION discrimination logic lives; this hook does not
 * reimplement it.
 *
 * Milestone 8.6: onNotificationHint takes NO arguments, by design, not
 * omission. Per M8.6 ADR-1, the hint is a pure trigger — App.tsx must
 * never derive notification content from a hint's payload. Giving the
 * callback the raw message would leave that invariant enforced only by
 * convention (a future edit could start reading msg.actor_name with
 * nothing stopping it); giving it nothing makes that misuse a
 * type/signature error instead. The hook still parses the message
 * internally to decide WHEN to call the callback — it just never
 * passes what it parsed along.
 *
 * The token travels as a query param (?token=) because the browser
 * WebSocket API doesn't support custom headers.
 *
 * The connection is opened when token is set, and closed when:
 *   - token becomes null (logout)
 *   - the component unmounts
 *
 * Token expiry: if the access token expires while the socket is open,
 * the connection continues until it naturally drops (server doesn't
 * re-validate mid-connection). On reconnect the client should pass a
 * fresh token. For this prototype, 15-min expiry is acceptable.
 */

import { useEffect, useRef } from "react"
import type { NewPostWSMessage } from "../types"
import { WS_BASE } from "../config"
import { isNotificationHint } from "../notification-hint.js"

export function useFeedWebSocket(
	token: string | null,
	onNewPost: (msg: NewPostWSMessage) => void,
	onNotificationHint: () => void,
) {
	const newPostRef = useRef(onNewPost)
	newPostRef.current = onNewPost

	const hintRef = useRef(onNotificationHint)
	hintRef.current = onNotificationHint

	useEffect(() => {
		if (!token) return

		const ws = new WebSocket(`${WS_BASE}/ws/feed?token=${token}`)

		ws.onmessage = (e) => {
			try {
				const msg = JSON.parse(e.data)
				if (msg.type === "NEW_POST") {
					newPostRef.current(msg as NewPostWSMessage)
				} else if (isNotificationHint(msg)) {
					hintRef.current()
				}
			} catch {
				/* ignore malformed */
			}
		}

		const ping = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) ws.send("ping")
		}, 20_000)

		return () => {
			clearInterval(ping)
			ws.close()
		}
	}, [token]) // reconnect when token changes (e.g. after refresh)
}
