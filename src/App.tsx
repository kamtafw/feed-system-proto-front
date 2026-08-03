/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react"
import { api, auth, clearTokens, decodeTokenPayload, getAccessToken } from "./api"
import "./App.css"
import { EventLog, type LogEntry } from "./components/event-log"
import { useSystemEvents } from "./hooks/use-system-events"
import type { AuthResponse, Post, SystemEvent, User } from "./types"
import { useFeedWebSocket } from "./hooks/use-feed-websocket"
import { LoginForm } from "./components/login-form"
import { useInfiniteScroll } from "./hooks/use-infinite-scroll"

let logIdCounter = 0

export default function App() {
	// auth state
	const [currentUser, setCurrentUser] = useState<User | null>(null)
	const [accessToken, setAccessToken] = useState<string | null>(null)

	// feed state
	const [users, setUsers] = useState<User[]>([])
	const [timeline, setTimeline] = useState<Post[]>([])
	const [following, setFollowing] = useState<Set<string>>(new Set())
	const [content, setContent] = useState("")
	const [posting, setPosting] = useState(false)
	const [newCount, setNewCount] = useState(0)
	const [logEntries, setLogEntries] = useState<LogEntry[]>([])

	// pagination state (Milestone 6)
	// nextCursor is opaque — never parsed, just stored and echoed back.
	const [nextCursor, setNextCursor] = useState<string | null>(null)
	const [hasMore, setHasMore] = useState(false) // false until the first page confirms otherwise
	const [loadingMore, setLoadingMore] = useState(false)

	// restore session from localStorage on mount
	useEffect(() => {
		const stored = getAccessToken()
		if (!stored) return

		const payload = decodeTokenPayload(stored)
		const exp = payload["exp"] as number | undefined

		if (exp && exp * 1000 > Date.now()) {
			setAccessToken(stored)
			setCurrentUser({ id: payload["sub"] as string, name: payload["name"] as string })
		} else {
			// token expired — clearTokens so the login form appears
			clearTokens()
		}
	}, [])

	// load data when user changes
	useEffect(() => {
		if (!currentUser) return
		setNewCount(0)
		setHasMore(false)
		setNextCursor(null)
		api.getTimeline(currentUser.id).then((page) => {
			setTimeline(page.posts)
			setNextCursor(page.next_cursor)
			setHasMore(page.next_cursor !== null)
		})
		api.getFollowing().then((ids) => setFollowing(new Set(ids)))
		api.getUsers().then(setUsers)
	}, [currentUser])

	// auth handlers
	const handleAuth = (response: AuthResponse) => {
		setAccessToken(response.access_token)
		setCurrentUser(response.user)
	}

	const handleLogout = async () => {
		await auth.logout()
		setCurrentUser(null)
		setAccessToken(null)
		setTimeline([])
		setFollowing(new Set())
		setNewCount(0)
		setNextCursor(null)
		setHasMore(false)
	}

	// timeline — top-of-feed refresh (the "N new posts" banner)
	// NOTE: this intentionally resets pagination back to page 1. If you've
	// scrolled several pages into history and then click the banner, those
	// older loaded pages are discarded in favor of a fresh top-of-feed view.
	// That's existing behavior carried over from before this milestone —
	// not something M6 introduces or fixes.
	const loadTimeline = useCallback(() => {
		if (!currentUser) return
		api.getTimeline(currentUser.id).then((page) => {
			setTimeline(page.posts)
			setNextCursor(page.next_cursor)
			setHasMore(page.next_cursor !== null)
			setNewCount(0)
		})
	}, [currentUser])

	// timeline — infinite scroll (append older posts to the tail)
	const loadMore = useCallback(() => {
		if (!currentUser || !hasMore || loadingMore) return
		setLoadingMore(true)
		api
			.getTimeline(currentUser.id, nextCursor ?? undefined)
			.then((page) => {
				setTimeline((prev) => [...prev, ...page.posts])
				setNextCursor(page.next_cursor)
				setHasMore(page.next_cursor !== null)
			})
			.catch((e) => console.error("Failed to load more posts:", e))
			.finally(() => setLoadingMore(false))
	}, [currentUser, hasMore, loadingMore, nextCursor])

	const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loadingMore)

	// personal WebSocket (NEW_POST)
	useFeedWebSocket(
		accessToken,
		useCallback(() => setNewCount((n) => n + 1), []),
	)

	// system event log
	useSystemEvents(
		useCallback((evt: SystemEvent) => {
			setLogEntries((prev) => [
				...prev.slice(-99), // keep last 100
				{ id: ++logIdCounter, ts: evt.ts, event: evt },
			])
		}, []),
	)

	const handlePost = async () => {
		if (!content.trim() || posting) return
		setPosting(true)
		try {
			const text = content.trim()
			const { post_id } = await api.createPost(text)
			// optimistic prepend — only touches the HEAD of the array, never
			// the pagination cursor at the tail. Unrelated to the M6 changes.
			setTimeline((prev) => [
				{
					id: post_id,
					author_id: currentUser!.id,
					author_name: currentUser!.name,
					content: text,
					created_at: Date.now() / 1000,
				},
				...prev,
			])
			setContent("")
		} catch (e) {
			console.error("Failed to post:", e)
		} finally {
			setPosting(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost()
	}

	// follow
	const handleFollow = async (targetId: string) => {
		if (following.has(targetId)) {
			await api.unfollow(targetId)
			setFollowing((prev) => {
				const s = new Set(prev)
				s.delete(targetId)
				return s
			})
		} else {
			await api.follow(targetId)
			setFollowing((prev) => new Set([...prev, targetId]))
		}
	}

	const otherUsers = users.filter((u) => u.id !== currentUser?.id)

	if (!currentUser) {
		return <LoginForm onAuth={handleAuth} />
	}

	return (
		<div className="app">
			<header className="header">
				<div className="logo">
					<span className="logo-icon">⚡</span>
					<span className="logo-text">FanoutFeed</span>
					<span className="logo-sub">Fanout-on-Write prototype</span>
				</div>
				<div className="header-user">
					<span className="header-avatar">{currentUser.name[0]}</span>
					<span className="header-name">{currentUser.name}</span>
					<button className="logout-btn" onClick={handleLogout}>
						Log out
					</button>
				</div>
			</header>

			<div className="layout">
				{/* Sidebar */}
				<aside className="sidebar">
					<h3 className="sidebar-title">People</h3>
					{otherUsers.map((u) => {
						const isFollowing = following.has(u.id)
						return (
							<div key={u.id} className="person-card">
								<div className="person-avatar">{u.name[0]}</div>
								<span className="person-name">{u.name}</span>
								<button
									className={`follow-btn ${isFollowing ? "follow-btn-active" : ""}`}
									onClick={() => handleFollow(u.id)}
									title={isFollowing ? `Unfollow ${u.name}` : `Follow ${u.name}`}
								>
									{isFollowing ? "Following" : "Follow"}
								</button>
							</div>
						)
					})}
				</aside>

				{/* Feed */}
				<main className="feed">
					{newCount > 0 && (
						<button className="banner" onClick={loadTimeline}>
							↑ {newCount} new post{newCount > 1 ? "s" : ""} — click to load
						</button>
					)}

					{/* Composer */}
					<div className="compose">
						<div className="compose-avatar">{currentUser.name[0]}</div>
						<div className="compose-inner">
							<textarea
								className="compose-textarea"
								placeholder={`What's on your mind, ${currentUser.name}?`}
								value={content}
								rows={3}
								onChange={(e) => setContent(e.target.value)}
								onKeyDown={handleKeyDown}
								disabled={posting}
							/>
							<div className="compose-footer">
								<span className="compose-hint">⌘↵ to post</span>
								<button
									className="post-btn"
									onClick={handlePost}
									disabled={!content.trim() || posting}
								>
									{posting ? "Posting…" : "Post"}
								</button>
							</div>
						</div>
					</div>

					<div className="timeline">
						{timeline.length === 0 ? (
							<div className="empty">
								No posts yet.
								<br />
								<span className="empty-hint">Follow someone or post something.</span>
							</div>
						) : (
							timeline.map((post) => (
								<div key={post.id} className="post-card">
									<div className="post-avatar">{post.author_name[0]}</div>
									<div className="post-body">
										<div className="post-meta">
											<strong className="post-author">{post.author_name}</strong>
											<span className="post-id">#{post.id}</span>
											<span className="post-time">
												{new Date(post.created_at * 1000).toLocaleTimeString()}
											</span>
										</div>
										<p className="post-content">{post.content}</p>
									</div>
								</div>
							))
						)}

						{/*	Milestone 6: infinite scroll sentinel — only rendered/observed
								while more pages exist. loadMore() fires when it enters the
								viewport (200px before it's actually visible). */}
						{hasMore && (
							<div ref={sentinelRef} className="scroll-sentinel">
								{loadingMore ? "Loading more…" : ""}
							</div>
						)}
						{!hasMore && timeline.length > 0 && (
							<div className="feed-end">You've reached the beginning of the feed.</div>
						)}
					</div>
				</main>

				<EventLog entries={logEntries} />
			</div>
		</div>
	)
}
