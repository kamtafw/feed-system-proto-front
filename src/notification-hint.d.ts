// notification-hint.d.ts — type declarations for notification-hint.js.
//
// notification-hint.js is deliberately plain JS (see its own docstring
// for why: zero-build-step node-runnability for test-notification-hint.mjs).
// This file exists only so `tsc -b` (part of `npm run build`) resolves
// the import cleanly without requiring `allowJs` in tsconfig — Vite's
// dev server already handles the plain-JS import fine on its own via
// esbuild, which doesn't need this file at all.

import type { NotificationHintWSMessage } from "./types"

export interface NotificationUIState {
	notifications: unknown[]
	unreadCount: number
	hasNewHint: boolean
}

export const REST_ONLY_FIELDS: readonly string[]

export function isNotificationHint(msg: unknown): msg is NotificationHintWSMessage

export function reconcileNotificationHint(
	state: NotificationUIState,
	hint: NotificationHintWSMessage,
): NotificationUIState

export function acknowledgeNotificationHint(state: NotificationUIState): NotificationUIState