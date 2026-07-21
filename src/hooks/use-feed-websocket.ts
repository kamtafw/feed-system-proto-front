/* eslint-disable react-hooks/refs */
/**
 * useFeedWebSocket — personal feed WebSocket channel.
 *
 * Replaces useUserWebSocket. The key difference: authentication.
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

export function useFeedWebSocket(token: string | null, onNewPost: (msg: NewPostWSMessage) => void) {
	const cbRef = useRef(onNewPost)
	cbRef.current = onNewPost

	useEffect(() => {
		if (!token) return

		const ws = new WebSocket(`${WS_BASE}/ws/feed?token=${token}`)

		ws.onmessage = (e) => {
			try {
				const msg = JSON.parse(e.data) as NewPostWSMessage
				if (msg.type === "NEW_POST") cbRef.current(msg)
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
