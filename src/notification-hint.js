/**
 * notification-hint.js — pure reconciliation logic for the
 * NEW_NOTIFICATION WebSocket hint (Milestone 8.5).
 *
 * Deliberately plain JS, not .ts: this module has zero framework
 * dependency and needs to be directly `node`-runnable by
 * test-notification-hint.mjs with no build step — the same way the
 * backend's test_*.py scripts run directly via `uv run` with no
 * pytest/build step. use-feed-websocket.ts imports this file as-is
 * (Vite/TS handle plain-JS imports natively, no config needed).
 *
 * ─────────────────────────────────────────────────────────────────────
 * CONTRACT — see docs/milestone-8.5-realtime-notification-hint.md:
 *
 * The NEW_NOTIFICATION hint is a non-authoritative, best-effort signal.
 * Postgres (via GET /notifications and GET /notifications/unread-count)
 * is the only source of truth for `notifications` and `unreadCount`.
 * reconcileNotificationHint() below must NEVER derive either of those
 * fields from the hint payload. The ONLY field it is allowed to touch
 * is `hasNewHint`, a purely local UI affordance flag — the same role
 * `newCount` already plays for NEW_POST in App.tsx. Opening the
 * notification UI is what's responsible for reconciling authoritative
 * state, by discarding local state and refetching — this module does
 * not perform that fetch itself; see acknowledgeNotificationHint().
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * @typedef {Object} NotificationHintMessage
 * @property {"NEW_NOTIFICATION"} type
 * @property {"NEW_POST"|"NEW_FOLLOWER"} notification_type
 * @property {string} actor_id
 * @property {string} actor_name
 * @property {string} object_type
 * @property {string} object_id
 */

/**
 * @typedef {Object} NotificationUIState
 * @property {unknown[]} notifications  REST-owned; opaque to this module
 * @property {number} unreadCount       REST-owned; opaque to this module
 * @property {boolean} hasNewHint       the ONLY field this module may set
 */

/** Fields that must NEVER appear on a hint payload — see module docstring. */
export const REST_ONLY_FIELDS = ["id", "created_at", "read_at"]

/**
 * True if a parsed WS message is a NEW_NOTIFICATION hint (as opposed to,
 * e.g., a NEW_POST message on the same /ws/feed connection).
 * @param {unknown} msg
 * @returns {msg is NotificationHintMessage}
 */
export function isNotificationHint(msg) {
	return typeof msg === "object" && msg !== null && msg.type === "NEW_NOTIFICATION"
}

/**
 * Reconciles an incoming hint against current notification UI state.
 * Enforces the non-mutation contract described in the module docstring
 * at runtime: throws if the payload ever carries a REST-only field,
 * rather than silently accepting a payload shaped like authoritative
 * state (which would indicate the backend/frontend wire contract has
 * drifted from what M8.5 established).
 * @param {NotificationUIState} state
 * @param {NotificationHintMessage} hint
 * @returns {NotificationUIState}
 */
export function reconcileNotificationHint(state, hint) {
	const drifted = REST_ONLY_FIELDS.filter((field) => field in hint)
	if (drifted.length > 0) {
		throw new Error(
			`NEW_NOTIFICATION hint unexpectedly contains REST-only field(s): ${drifted.join(", ")}. ` +
				"The wire contract has drifted from what M8.5 established — see " +
				"docs/milestone-8.5-realtime-notification-hint.md ADR-4.",
		)
	}
	return {
		notifications: state.notifications, // untouched — REST-owned
		unreadCount: state.unreadCount, // untouched — REST-owned
		hasNewHint: true,
	}
}

/**
 * Called when the user opens the notification UI. Clears the local
 * affordance flag only. Deliberately does NOT fetch — the caller is
 * responsible for triggering the REST refetch that actually reconciles
 * authoritative state (GET /notifications, GET /notifications/unread-count),
 * the same reset-and-refetch shape App.tsx's loadTimeline() already uses
 * for posts. Wiring that refetch is part of the full notification-UI
 * milestone, not this one.
 * @param {NotificationUIState} state
 * @returns {NotificationUIState}
 */
export function acknowledgeNotificationHint(state) {
	return { ...state, hasNewHint: false }
}
