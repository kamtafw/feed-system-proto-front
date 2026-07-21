/* eslint-disable react-hooks/refs */
import { useEffect, useRef } from "react"
import type { SystemEvent } from "../types"
import { WS_BASE } from "../config"

export function useSystemEvents(onEvent: (e: SystemEvent) => void) {
	const cbRef = useRef(onEvent)
	cbRef.current = onEvent // always up-to-date without re-triggering effect

	useEffect(() => {
		const ws = new WebSocket(`${WS_BASE}/ws/events`)

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
