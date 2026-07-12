import { useEffect, useRef } from "react"
import type { NewPostWSMessage } from "../types"

export function useUserWebSocket(
	userId: string | null,
	onNewPost: (msg: NewPostWSMessage) => void,
) {
	const cbRef = useRef(onNewPost)
	// eslint-disable-next-line react-hooks/refs
	cbRef.current = onNewPost // always up-to-date without re-triggering effect

	useEffect(() => {
		if (!userId) return

		const ws = new WebSocket(`ws://localhost:8000/ws/${userId}`)

		ws.onmessage = (e) => {
			try {
				const msg = JSON.parse(e.data)
				if (msg.type === "NEW_POST") cbRef.current(msg)
			} catch {
				/* ignore */
			}
		}

		// keep-alive ping every 20s
		const ping = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) ws.send("ping")
		}, 20_000)

		return () => {
			clearInterval(ping)
			ws.close()
		}
	}, [userId])
}
