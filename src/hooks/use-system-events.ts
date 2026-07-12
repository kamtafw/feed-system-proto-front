import { useEffect, useRef } from "react"
import type { SystemEvent } from "../types"

export function useSystemEvents(onEvent: (e: SystemEvent) => void) {
	const cbRef = useRef(onEvent)
	// eslint-disable-next-line react-hooks/refs
	cbRef.current = onEvent // always up-to-date without re-triggering effect

	useEffect(() => {
		const ws = new WebSocket("ws://localhost:8000/ws/events")

		ws.onmessage = (e) => {
			try {
				const evt = JSON.parse(e.data) as SystemEvent
				cbRef.current(evt)
			} catch {
				/* ignore */
			}
		}

		const ping = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) ws.send("ping")
		}, 20_000)

		return () => {
			clearInterval(ping)
			ws.close()
		}
	}, []) // connects once for the lifetime of the app
}
