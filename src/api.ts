import type { Post, User } from "./types"

const BASE = "http://localhost:8000"

export const api = {
	getUsers: (): Promise<User[]> => fetch(`${BASE}/users`).then((r) => r.json()),

	getTimeline: (userId: string): Promise<Post[]> =>
		fetch(`${BASE}/timeline/${userId}`).then((r) => r.json()),

	createPost: (authorId: string, content: string): Promise<{ post_id: string }> =>
		fetch(`${BASE}/posts?author_id=${authorId}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		}).then((r) => r.json()),

	getFollowing: (userId: string): Promise<string[]> =>
		fetch(`${BASE}/users/${userId}/following`).then((r) => r.json()),

	follow: (userId: string, targetId: string): Promise<void> =>
		fetch(`${BASE}/users/${userId}/follow/${targetId}`, { method: "POST" }).then(() => undefined),

	unfollow: (userId: string, targetId: string): Promise<void> =>
		fetch(`${BASE}/users/${userId}/follow/${targetId}`, { method: "DELETE" }).then(() => undefined),
}
