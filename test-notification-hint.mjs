// test-notification-hint.mjs — verification for isNotificationHint(),
// the one piece of notification-hint.js that survives Milestone 8.6
// (see ADR-5: reconcileNotificationHint, acknowledgeNotificationHint,
// and NotificationUIState were retired along with their entire reason
// for existing — see notification-hint.js's module docstring).
//
// Run directly, no build step, no test framework:
//     node test-notification-hint.mjs
//
// What it proves:
//   1. A NEW_POST message is correctly NOT identified as a notification
//      hint.
//   2. A NEW_NOTIFICATION message correctly IS identified as one.
//   3. Malformed/absent messages (null, a bare string, an object with
//      no type field) don't crash the check — they're just not hints.

import assert from "node:assert/strict"
import { isNotificationHint } from "./src/notification-hint.js"

const SEP = "—".repeat(56)

function section(n, title) {
	console.log(`\n[${n}] ${title}`)
}

console.log(SEP)
console.log(" FanoutFeed — NEW_NOTIFICATION discrimination (Milestone 8.6)")
console.log(SEP)

section(1, "NEW_POST is not treated as a hint")
const newPostMsg = { type: "NEW_POST", post_id: "p1", author_id: "alice", author_name: "Alice" }
assert.equal(isNotificationHint(newPostMsg), false)
console.log("    ✅  NEW_POST correctly excluded")

section(2, "NEW_NOTIFICATION is treated as a hint")
const hintMsg = {
	type: "NEW_NOTIFICATION",
	notification_type: "NEW_POST",
	actor_id: "alice",
	actor_name: "Alice",
	object_type: "post",
	object_id: "p1",
}
assert.equal(isNotificationHint(hintMsg), true)
console.log("    ✅  NEW_NOTIFICATION correctly included")

section(3, "Malformed input doesn't crash the check")
assert.equal(isNotificationHint(null), false)
assert.equal(isNotificationHint(undefined), false)
assert.equal(isNotificationHint("not an object"), false)
assert.equal(isNotificationHint({}), false)
console.log("    ✅  null, undefined, a string, and an empty object are all safely rejected")

console.log(`\n${SEP}`)
console.log(" isNotificationHint() verified — the sole survivor of M8.5's")
console.log(" notification-hint.js after M8.6's ADR-5 retirement.")
console.log(SEP)
