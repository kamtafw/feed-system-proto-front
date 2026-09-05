// test-notification-hint.mjs — Milestone 8.5 verification for the
// NEW_NOTIFICATION WebSocket hint's reconciliation contract.
//
// Run directly, no build step, no test framework:
//     node test-notification-hint.mjs
//
// Mirrors the backend's test_*.py convention: a standalone script that
// exercises the REAL functions the app uses (src/notification-hint.js),
// not a reimplementation of them — use-feed-websocket.ts imports the
// identical module this script does.
//
// What it proves:
//   1. isNotificationHint() correctly discriminates NEW_NOTIFICATION
//      messages from other /ws/feed message shapes (e.g. NEW_POST).
//   2. The hint payload is structurally distinct from the REST
//      Notification representation — no id/created_at/read_at.
//   3. reconcileNotificationHint() never mutates `notifications` or
//      `unreadCount` — the only field it changes is the local
//      `hasNewHint` affordance flag.
//   4. reconcileNotificationHint() rejects (throws on) a hint payload
//      that DOES carry a REST-only field — a loud dev-time guard
//      against the wire contract silently drifting toward the
//      authoritative shape.
//   5. acknowledgeNotificationHint() clears hasNewHint without touching
//      anything else.

import assert from "node:assert/strict"
import {
	isNotificationHint,
	reconcileNotificationHint,
	acknowledgeNotificationHint,
	REST_ONLY_FIELDS,
} from "./src/notification-hint.js"

const SEP = "—".repeat(56)

function section(n, title) {
	console.log(`\n[${n}] ${title}`)
}

console.log(SEP)
console.log(" FanoutFeed — NEW_NOTIFICATION hint verification (Milestone 8.5)")
console.log(SEP)

// [1] Message discrimination
section(1, "isNotificationHint discriminates message types")
const newPostMsg = { type: "NEW_POST", post_id: "p1", author_id: "alice", author_name: "Alice" }
const hintMsg = {
	type: "NEW_NOTIFICATION",
	notification_type: "NEW_POST",
	actor_id: "alice",
	actor_name: "Alice",
	object_type: "post",
	object_id: "p1",
}
assert.equal(isNotificationHint(newPostMsg), false, "NEW_POST should not be treated as a hint")
assert.equal(isNotificationHint(hintMsg), true, "NEW_NOTIFICATION should be treated as a hint")
console.log("    ✅  NEW_POST and NEW_NOTIFICATION messages are correctly distinguished")

// [2] Payload is structurally distinct from the REST representation
section(2, "Hint payload shape is distinct from the REST Notification shape")
for (const field of REST_ONLY_FIELDS) {
	assert.ok(!(field in hintMsg), `Hint payload should never carry REST-only field '${field}'`)
}
console.log(`    ✅  Hint payload carries none of: ${REST_ONLY_FIELDS.join(", ")}`)

// [3] Reconciliation never mutates authoritative state
section(3, "reconcileNotificationHint never touches notifications/unreadCount")
const initialState = {
	notifications: [
		{
			id: 1,
			recipient_id: "bob",
			actor_id: "alice",
			type: "NEW_POST",
			object_type: "post",
			object_id: "p0",
			created_at: 1,
			read_at: null,
		},
	],
	unreadCount: 3,
	hasNewHint: false,
}
const afterHint = reconcileNotificationHint(initialState, hintMsg)
assert.equal(
	afterHint.notifications,
	initialState.notifications,
	"notifications array reference must be unchanged",
)
assert.equal(afterHint.unreadCount, initialState.unreadCount, "unreadCount must be unchanged")
assert.equal(afterHint.hasNewHint, true, "hasNewHint should flip to true")
console.log("    ✅  notifications and unreadCount untouched; only hasNewHint changed")

// [4] A hint carrying a REST-only field is rejected loudly
section(4, "A malformed hint carrying a REST-only field is rejected")
const malformedHint = { ...hintMsg, id: 999 }
assert.throws(
	() => reconcileNotificationHint(initialState, malformedHint),
	/REST-only field/,
	"reconcileNotificationHint should throw if the payload drifts toward the REST shape",
)
console.log("    ✅  A hint shaped like the REST representation is rejected, not silently accepted")

// [5] Acknowledging clears only the local flag
section(5, "acknowledgeNotificationHint clears hasNewHint only")
const acked = acknowledgeNotificationHint(afterHint)
assert.equal(acked.hasNewHint, false, "hasNewHint should be cleared")
assert.equal(acked.notifications, afterHint.notifications, "notifications must still be untouched")
assert.equal(acked.unreadCount, afterHint.unreadCount, "unreadCount must still be untouched")
console.log("    ✅  Acknowledging the hint only clears the local affordance flag")

console.log(`\n${SEP}`)
console.log(" NEW_NOTIFICATION hint contract verified — distinct payload shape,")
console.log(" zero mutation of authoritative state, malformed payloads rejected.")
console.log(SEP)
