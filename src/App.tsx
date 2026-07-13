import { useCallback, useEffect, useState } from "react"
import { api } from "./api"
import "./App.css"
import { EventLog, type LogEntry } from "./components/event-log"
import { useSystemEvents } from "./hooks/use-system-events"
import { useUserWebSocket } from "./hooks/use-user-websocket"
import type { NewPostWSMessage, Post, SystemEvent, User } from "./types"

let logIdCounter = 0

export default function App() {
	const [users, setUsers] = useState<User[]>([]) // all users from /users
	const [currentUser, setCurrentUser] = useState<User | null>(null) // who's "logged in"
	const [timeline, setTimeline] = useState<Post[]>([]) // their posts
	const [following, setFollowing] = useState<Set<string>>(new Set()) // Set<string> of who they follow
	const [content, setContent] = useState("") // compose textarea
	const [posting, setPosting] = useState(false) // loading state for post button
	const [newCount, setNewCount] = useState(0) // count of unseen new posts
	const [logEntries, setLogEntries] = useState<LogEntry[]>([]) // system event log entries

	// load users once on mount
	useEffect(() => {
		api.getUsers().then(setUsers)
	}, [])

	// when currentUser changes: load their timeline + following
	useEffect(() => {
		if (!currentUser) return
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setNewCount(0) // clear banner from previous user
		api.getTimeline(currentUser.id).then(setTimeline)
		api.getFollowing(currentUser.id).then((ids) => setFollowing(new Set(ids)))
	}, [currentUser])

	const loadTimeline = useCallback((uid: string) => {
		api.getTimeline(uid).then((posts) => {
			setTimeline(posts)
			setNewCount(0)
		})
	}, [])

	const handleBannerClick = () => {
		if (currentUser) loadTimeline(currentUser.id)
	}

	// Personal WebSocket (NEW_POST)
	useUserWebSocket(
		currentUser?.id ?? null,
		useCallback((_msg: NewPostWSMessage) => {
			setNewCount((n) => n + 1)
		}, []),
	)

	// System event log
	useSystemEvents(
		useCallback((evt: SystemEvent) => {
			setLogEntries((prev) => [
				...prev.slice(-99), // keep last 100
				{ id: ++logIdCounter, ts: evt.ts, event: evt },
			])
		}, []),
	)

	const handlePost = async () => {
		if (!currentUser || !content.trim() || posting) return
		setPosting(true)
		await api.createPost(currentUser.id, content.trim())
		setContent("")
		const posts = await api.getTimeline(currentUser.id)
		setTimeline(posts)
		setPosting(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost()
	}

	// follow
	const handleFollow = async (targetId: string) => {
		if (!currentUser) return
		if (following.has(targetId)) {
			await api.unfollow(currentUser.id, targetId)
			setFollowing((prev) => {
				const s = new Set(prev)
				s.delete(targetId)
				return s
			})
		} else {
			await api.follow(currentUser.id, targetId)
			setFollowing((prev) => new Set([...prev, targetId]))
		}
	}

	const otherUsers = users.filter((u) => u.id !== currentUser?.id)

	return (
		<div className="app">
			<header className="header">
				<div className="logo">
					<span className="logo-icon">⚡</span>
					<span className="logo-text">FanoutFeed</span>
					<span className="logo-sub">Fanout-on-Write prototype</span>
				</div>
				<nav className="user-tabs">
					{users.map((u) => (
						<button
							key={u.id}
							className={`tab ${currentUser?.id === u.id ? "tab-active" : ""}`}
							onClick={() => setCurrentUser(u)}
						>
							<span className="tab-avatar">{u.name[0]}</span>
							{u.name}
						</button>
					))}
				</nav>
			</header>

			{!currentUser ? (
				<div className="splash">
					<div className="splash-inner">
						<p className="splash-title">Select a user above to start</p>
						<p className="splash-hint">
							Open this page in two tabs and pick different users to see
							<br />
							realtime notifications fire between them.
						</p>
					</div>
				</div>
			) : (
				<div className="layout">
					{/* Sidebar: People */}
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

					{/* Main Feed */}
					<main className="feed">
						{/* new post banner */}
						{newCount > 0 && (
							<button className="banner" onClick={handleBannerClick}>
								↑ {newCount} new post{newCount > 1 ? "s" : ""} — click to load
							</button>
						)}

						{/* Compose */}
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

						{/* Posts */}
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
						</div>
					</main>

					<EventLog entries={logEntries} />
				</div>
			)}
		</div>
	)
}
