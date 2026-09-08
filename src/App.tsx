/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { api, auth, clearTokens, decodeTokenPayload, getAccessToken } from "./api"
import "./App.css"
import { EventLog, type LogEntry } from "./components/event-log"
import { useSystemEvents } from "./hooks/use-system-events"
import type { AuthResponse, Notification, Post, SystemEvent, User } from "./types"
import { useFeedWebSocket } from "./hooks/use-feed-websocket"
import { LoginForm } from "./components/login-form"
import { useInfiniteScroll } from "./hooks/use-infinite-scroll"

let logIdCounter = 0

// Milestone 8.6: renders a Notification row's verb. type is a closed
// union ("NEW_POST" | "NEW_FOLLOWER") so the default branch is
// currently unreachable — kept anyway as a defensive fallback matching
// the style already used elsewhere in this app (e.g.
// notify_new_follower_hint's follower_id fallback), so a future
// notification type degrades gracefully instead of crashing this
// component before anyone remembers to update it here.
function describeNotification(n: Notification): string {
	switch (n.type) {
		case "NEW_FOLLOWER":
			return "followed you"
		case "NEW_POST":
			return "posted a new post"
		default:
			return "did something"
	}
}

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

	// Milestone 8.6: notification state. REST-backed by construction —
	// nothing here is ever set from a NEW_NOTIFICATION hint's payload,
	// only from GET /notifications / GET /notifications/unread-count
	// responses. See docs/milestone-8.6-notification-reconciliation.md.
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [notifCursor, setNotifCursor] = useState<string | null>(null)
	const [notifHasMore, setNotifHasMore] = useState(false)
	const [loadingMoreNotifs, setLoadingMoreNotifs] = useState(false)
	const [unreadCount, setUnreadCount] = useState(0)
	const [notifPanelOpen, setNotifPanelOpen] = useState(false)

	// M8.6 ADR-6: per-function sequence counters guarding against an
	// older hint-triggered (or panel-open-triggered) response arriving
	// after a newer one and overwriting fresher state. loadTimeline()
	// has no equivalent guard and doesn't need one — its only trigger is
	// a human click, with no realistic overlap. loadNotifications() and
	// refreshUnreadCount() gain a trigger loadTimeline() doesn't have —
	// NEW_NOTIFICATION hints, fired by independent backend events with
	// no human reaction-time buffer between them — so copying
	// loadTimeline()'s unguarded shape here would carry a harmless race
	// into a context where it's actually reachable.
	const notifFetchSeq = useRef(0)
	const unreadFetchSeq = useRef(0)

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

	// Milestone 8.6 — notification loaders/actions. Defined here, BEFORE
	// the mount-data effect below, so that effect can call them directly
	// rather than duplicating their fetch logic inline (unlike
	// loadTimeline(), which the mount effect duplicates rather than
	// calls). That duplication would be fine for loadTimeline() — its
	// mount-time fetch and its banner-click fetch don't race in any way
	// that matters — but it would reopen exactly the race ADR-6 exists
	// to close: a mount-time fetch and a hint-triggered fetch both
	// running through their OWN separate un-sequenced logic could still
	// stomp each other. Routing every trigger (mount, hint, panel-open)
	// through these same two functions is what makes the sequence guard
	// actually cover every path, not just some of them.

	const loadNotifications = useCallback(() => {
		if (!currentUser) return
		const seq = ++notifFetchSeq.current
		api
			.getNotifications()
			.then((page) => {
				if (seq !== notifFetchSeq.current) return // a newer call already started — discard this stale response
				setNotifications(page.notifications)
				setNotifCursor(page.next_cursor)
				setNotifHasMore(page.next_cursor !== null)
			})
			.catch((e) => console.error("Failed to load notifications:", e))
	}, [currentUser])

	// notifications — infinite pagination (append older rows to the tail).
	// Mirrors loadMore()'s existing loadingMore-boolean guard exactly,
	// not the sequence-counter approach above — this operation's trigger
	// (user-paced pagination) matches loadMore()'s trigger shape, not
	// the hint's, so the same structural "never two in flight" guard
	// that already works for loadMore() applies here too.
	const loadMoreNotifications = useCallback(() => {
		if (!currentUser || !notifHasMore || loadingMoreNotifs) return
		setLoadingMoreNotifs(true)
		api
			.getNotifications(notifCursor ?? undefined)
			.then((page) => {
				setNotifications((prev) => [...prev, ...page.notifications])
				setNotifCursor(page.next_cursor)
				setNotifHasMore(page.next_cursor !== null)
			})
			.catch((e) => console.error("Failed to load more notifications:", e))
			.finally(() => setLoadingMoreNotifs(false))
	}, [currentUser, notifHasMore, loadingMoreNotifs, notifCursor])

	const refreshUnreadCount = useCallback(() => {
		if (!currentUser) return
		const seq = ++unreadFetchSeq.current
		api
			.getUnreadCount()
			.then(({ count }) => {
				if (seq !== unreadFetchSeq.current) return
				setUnreadCount(count)
			})
			.catch((e) => console.error("Failed to refresh unread count:", e))
	}, [currentUser])

	const markOneRead = useCallback(
		(id: number) => {
			api
				.markNotificationRead(id)
				.then(() => {
					loadNotifications()
					refreshUnreadCount()
				})
				.catch((e) => console.error("Failed to mark notification read:", e))
		},
		[loadNotifications, refreshUnreadCount],
	)

	const markAllRead = useCallback(() => {
		api
			.markAllNotificationsRead()
			.then(() => {
				loadNotifications()
				refreshUnreadCount()
			})
			.catch((e) => console.error("Failed to mark all notifications read:", e))
	}, [loadNotifications, refreshUnreadCount])

	// load data when user changes
	useEffect(() => {
		if (!currentUser) return
		setNewCount(0)
		setHasMore(false)
		setNextCursor(null)
		setNotifications([])
		setNotifCursor(null)
		setNotifHasMore(false)
		setNotifPanelOpen(false)
		setUnreadCount(0)
		api.getTimeline(currentUser.id).then((page) => {
			setTimeline(page.posts)
			setNextCursor(page.next_cursor)
			setHasMore(page.next_cursor !== null)
		})
		api.getFollowing().then((ids) => setFollowing(new Set(ids)))
		api.getUsers().then(setUsers)
		loadNotifications()
		refreshUnreadCount()
	}, [currentUser, loadNotifications, refreshUnreadCount])

	// notifications — fetch fresh page 1 every time the panel opens.
	// Same reset-and-refetch shape as loadTimeline()'s banner click:
	// closes any staleness gap regardless of whether every intervening
	// hint actually arrived while the panel was closed.
	useEffect(() => {
		if (notifPanelOpen) loadNotifications()
	}, [notifPanelOpen, loadNotifications])

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
		setNotifications([])
		setNotifCursor(null)
		setNotifHasMore(false)
		setNotifPanelOpen(false)
		setUnreadCount(0)
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

	// Milestone 8.6 ADR-1: the hint is a pure trigger. It NEVER receives
	// or reads any field from the WS message — see
	// useFeedWebSocket's onNotificationHint signature, which takes no
	// arguments at all, making that structurally true rather than just
	// documented.
	const handleNotificationHint = useCallback(() => {
		refreshUnreadCount()
		if (notifPanelOpen) loadNotifications()
	}, [notifPanelOpen, refreshUnreadCount, loadNotifications])

	// personal WebSocket (NEW_POST + NEW_NOTIFICATION)
	useFeedWebSocket(
		accessToken,
		useCallback(() => setNewCount((n) => n + 1), []),
		handleNotificationHint,
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

	// Milestone 8.6: the REST Notification row only carries actor_id, not
	// a display name (confirmed against the actual M8 type/route before
	// assuming otherwise). Rather than adding a backend field — explicitly
	// out of scope, "no new backend code" — this resolves display names
	// client-side from `users`, which is already fetched on mount for the
	// sidebar. Falls back to the raw id if a user is somehow missing from
	// that list, matching the defensive-fallback style already used
	// elsewhere (e.g. notify_new_follower_hint's follower_id fallback).
	const usersById = useMemo(() => {
		const map: Record<string, User> = {}
		for (const u of users) map[u.id] = u
		return map
	}, [users])

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
					<div className="notification-wrap">
						<button
							className="notification-hint-btn"
							onClick={() => setNotifPanelOpen((open) => !open)}
							title="Notifications"
						>
							🔔
							{unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
						</button>

						{notifPanelOpen && (
							<div className="notification-panel">
								<div className="notification-panel-header">
									<span>Notifications</span>
									<button className="notification-mark-all" onClick={markAllRead}>
										Mark all read
									</button>
								</div>
								<div className="notification-list">
									{notifications.length === 0 ? (
										<div className="notification-empty">No notifications yet.</div>
									) : (
										notifications.map((n) => {
											const actorName = usersById[n.actor_id]?.name ?? n.actor_id
											return (
												<div
													key={n.id}
													className={`notification-item ${
														n.read_at === null ? "notification-item-unread" : ""
													}`}
													onClick={() => {
														if (n.read_at === null) markOneRead(n.id)
													}}
												>
													<div className="notification-item-avatar">{actorName[0]}</div>
													<div className="notification-item-body">
														<span className="notification-item-actor">{actorName}</span>{" "}
														{describeNotification(n)}
														<div className="notification-item-time">
															{new Date(n.created_at * 1000).toLocaleTimeString()}
														</div>
													</div>
												</div>
											)
										})
									)}
									{notifHasMore && (
										<button
											className="notification-load-more"
											onClick={loadMoreNotifications}
											disabled={loadingMoreNotifs}
										>
											{loadingMoreNotifs ? "Loading…" : "Load more"}
										</button>
									)}
								</div>
							</div>
						)}
					</div>
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
