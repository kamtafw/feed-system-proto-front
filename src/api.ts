/**
 * api.ts — All HTTP calls in one place.
 *
 * Token management:
 *   - Access token stored in localStorage (ff_access)
 *   - Refresh token stored in localStorage (ff_refresh)
 *   - authedFetch() attaches Bearer header and retries once on 401 (via refresh)
 *
 * localStorage for tokens is fine for this prototype. In production you'd
 * store refresh tokens in an httpOnly cookie to prevent XSS access.
 */

import { HTTP_BASE } from "./config"
import type { AuthResponse, Post, User } from "./types"

const BASE = HTTP_BASE

const ACCESS_KEY = "ff_access"
const REFRESH_KEY = "ff_refresh"

// Token storage

export function getAccessToken(): string | null {
	return localStorage.getItem(ACCESS_KEY)
}

export function setTokens(access: string, refresh: string): void {
	localStorage.setItem(ACCESS_KEY, access)
	localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens(): void {
	localStorage.removeItem(ACCESS_KEY)
	localStorage.removeItem(REFRESH_KEY)
}

/** decode the JWT payload without verifying the signature (client-side only) */
export function decodeTokenPayload(token: string): Record<string, unknown> {
	try {
		return JSON.parse(atob(token.split(".")[1]))
	} catch {
		return {}
	}
}

// Token refresh

async function attemptTokenRefresh(): Promise<string> {
	const refresh = localStorage.getItem(REFRESH_KEY)
	if (!refresh) throw new Error("No refresh token stored")

	const res = await fetch(`${BASE}/auth/refresh`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refresh_token: refresh }),
	})

	if (!res.ok) {
		clearTokens()
		throw new Error("Session expired — please log in again")
	}

	const data = await res.json()
	setTokens(data.access_token, data.refresh_token)
	return data.access_token
}

// Authenticated fetch wrapper

async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
	const token = getAccessToken()
	if (!token) throw new Error("Not authenticated")

	const withBearer = (t: string): RequestInit => ({
		...options,
		headers: {
			"Content-Type": "application/json",
			...options.headers,
			Authorization: `Bearer ${t}`,
		},
	})

	let res = await fetch(url, withBearer(token))

	if (res.status === 401) {
		// access token expired — try to get a new one with the refresh token
		const newToken = await attemptTokenRefresh()
		res = await fetch(url, withBearer(newToken))
	}

	return res
}

// Auth API

export const auth = {
	register: (username: string, password: string, displayName?: string): Promise<AuthResponse> =>
		fetch(`${BASE}/auth/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password, display_name: displayName ?? username }),
		}).then(async (r) => {
			const data = await r.json()
			if (!r.ok) throw new Error(data.detail ?? "Registration failed")
			return data as AuthResponse
		}),

	login: (username: string, password: string): Promise<AuthResponse> =>
		fetch(`${BASE}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password }),
		}).then(async (r) => {
			const data = await r.json()
			if (!r.ok) throw new Error(data.detail ?? "Login failed")
			return data as AuthResponse
		}),

	logout: (): Promise<void> => {
		const refresh = localStorage.getItem(REFRESH_KEY)
		clearTokens()
		if (!refresh) return Promise.resolve()
		return fetch(`${BASE}/auth/logout`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refresh }),
		}).then(() => undefined)
	},
}

// Application API (all require auth)

export const api = {
	getUsers: (): Promise<User[]> => fetch(`${BASE}/users`).then((r) => r.json()),

	getTimeline: (userId: string): Promise<Post[]> =>
		fetch(`${BASE}/timeline/${userId}`).then((r) => r.json()),

	getFollowing: (): Promise<string[]> => authedFetch(`${BASE}/me/following`).then((r) => r.json()),

	createPost: (content: string): Promise<{ post_id: string }> =>
		authedFetch(`${BASE}/posts`, {
			method: "POST",
			body: JSON.stringify({ content }),
		}).then((r) => r.json()),

	follow: (targetId: string): Promise<void> =>
		authedFetch(`${BASE}/me/follow/${targetId}`, { method: "POST" }).then(() => undefined),

	unfollow: (targetId: string): Promise<void> =>
		authedFetch(`${BASE}/me/follow/${targetId}`, { method: "DELETE" }).then(() => undefined),
}
