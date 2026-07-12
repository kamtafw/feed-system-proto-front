import { useEffect, useRef } from "react"
import type { SystemEvent } from "../types"

interface LogEntry {
	id: number
	ts: number
	event: SystemEvent
}

interface Props {
	entries: LogEntry[]
}

function fmtTime(ts: number) {
	return new Date(ts * 1000).toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	})
}

function EventRow({ entry }: { entry: LogEntry }) {
	const { event } = entry

	switch (event.event) {
		case "POST_CREATED":
			return (
				<div className="log-entry log-post">
					<span className="log-time">{fmtTime(event.ts)}</span>
					<span className="log-icon">📝</span>
					<div className="log-body">
						<div className="log-label">POST_CREATED</div>
						<div className="log-detail">
							<span className="log-author">{event.author}</span>
							{" → "}
							<span className="log-id">#{event.post_id}</span>
						</div>
						<div className="log-content">"{event.content}"</div>
					</div>
				</div>
			)

		case "FANOUT_START":
			return (
				<div className="log-entry log-fanout">
					<span className="log-time">{fmtTime(event.ts)}</span>
					<span className="log-icon">📢</span>
					<div className="log-body">
						<div className="log-label">FANOUT_CONSUMER</div>
						<div className="log-detail">
							Writing to <strong>{event.followers.length}</strong> timeline
							{event.followers.length !== 1 ? "s" : ""}
							{event.followers.length > 0 && (
								<span className="log-targets"> [{event.followers.join(", ")}]</span>
							)}
						</div>
					</div>
				</div>
			)

		case "FANOUT_WRITE":
			return (
				<div className="log-entry log-fanout-write">
					<span className="log-time">{fmtTime(event.ts)}</span>
					<span className="log-icon">✅</span>
					<div className="log-body">
						<div className="log-detail">
							<span className="log-target">{event.target}</span> timeline ←{" "}
							<span className="log-id">#{event.post_id}</span>
						</div>
					</div>
				</div>
			)

		case "REALTIME_START":
			return (
				<div className="log-entry log-realtime">
					<span className="log-time">{fmtTime(event.ts)}</span>
					<span className="log-icon">⚡</span>
					<div className="log-body">
						<div className="log-label">REALTIME_CONSUMER</div>
						<div className="log-detail">
							Online: <span className="log-online">[{event.online.join(", ") || "none"}]</span>
							{event.offline.length > 0 && (
								<>
									{" "}
									· Offline: <span className="log-offline">[{event.offline.join(", ")}]</span>
								</>
							)}
						</div>
					</div>
				</div>
			)

		case "REALTIME_SEND":
			return (
				<div className="log-entry log-realtime-send">
					<span className="log-time">{fmtTime(event.ts)}</span>
					<span className="log-icon">📱</span>
					<div className="log-body">
						<div className="log-detail">
							NEW_POST → <span className="log-target">{event.target}</span>
						</div>
					</div>
				</div>
			)

		case "REALTIME_SKIP":
			return (
				<div className="log-entry log-realtime-skip">
					<span className="log-time">{fmtTime(event.ts)}</span>
					<span className="log-icon">⚫</span>
					<div className="log-body">
						<div className="log-detail">
							<span className="log-target">{event.target}</span> is offline — skipped
						</div>
					</div>
				</div>
			)

		default:
			return null
	}
}

export function EventLog({ entries }: Props) {
	const bottomRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [entries])

	return (
		<aside className="event-log">
			<div className="event-log-header">
				<span className="event-log-title">Event Stream</span>
				<span className="event-log-dot" />
				<span className="event-log-live">LIVE</span>
			</div>
			<div className="event-log-body">
				{entries.length === 0 && (
					<div className="log-empty">
						Waiting for events…
						<br />
						<span className="log-hint">Post something to see the fanout in action.</span>
					</div>
				)}
				{entries.map((e) => (
					<EventRow key={e.id} entry={e} />
				))}
				<div ref={bottomRef} />
			</div>
		</aside>
	)
}

export type { LogEntry }
