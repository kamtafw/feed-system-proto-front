/**
 * notification-hint.js — WebSocket message discrimination for the
 * NEW_NOTIFICATION live hint.
 *
 * Milestone 8.6 retired reconcileNotificationHint(),
 * acknowledgeNotificationHint(), and NotificationUIState (M8.6 ADR-5).
 * Their entire purpose was to hold the line — "hasNewHint may change,
 * notifications/unreadCount may not" — until real REST-backed state
 * existed to enforce that line for real. That reason ended once M8.6
 * shipped: the hint is now purely a trigger for loadNotifications()/
 * refreshUnreadCount() in App.tsx, which are REST-backed by
 * construction. There is no longer a separate "reconciled" state
 * object for this module to guard.
 *
 * isNotificationHint() is the one thing that survives unchanged:
 * WebSocket message discrimination on /ws/feed is still needed
 * regardless of what happens after a hint is identified as one.
 *
 * Per M8.6 ADR-1, this function is also the ONLY thing anything in this
 * app is allowed to do with a hint's shape — check its type
 * discriminator. Nothing anywhere reads notification_type/actor_id/
 * actor_name/object_type/object_id from a hint. Those fields exist on
 * the wire for a possible future consumer, not for this one.
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
 * True if a parsed WS message is a NEW_NOTIFICATION hint (as opposed
 * to, e.g., a NEW_POST message on the same /ws/feed connection).
 * @param {unknown} msg
 * @returns {msg is NotificationHintMessage}
 */
export function isNotificationHint(msg) {
	return typeof msg === "object" && msg !== null && msg.type === "NEW_NOTIFICATION"
}
