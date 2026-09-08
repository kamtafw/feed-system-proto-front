// notification-hint.d.ts — type declarations for notification-hint.js.
//
// Shrunk in Milestone 8.6 (ADR-5): reconcileNotificationHint,
// acknowledgeNotificationHint, and NotificationUIState were retired
// along with their JS implementations. isNotificationHint is the only
// export that survives.
//
// notification-hint.js is deliberately plain JS (zero-build-step
// node-runnability for test-notification-hint.mjs). This file exists
// only so `tsc -b` resolves the import cleanly without requiring
// `allowJs` in tsconfig — Vite's dev server handles the plain-JS
// import fine on its own via esbuild and never needed this file at all.

import type { NotificationHintWSMessage } from "./types"

export function isNotificationHint(msg: unknown): msg is NotificationHintWSMessage
