import { useState } from "react"
import { auth, setTokens } from "../api"
import type { AuthResponse } from "../types"

interface Props {
	onAuth: (response: AuthResponse) => void
}

export function LoginForm({ onAuth }: Props) {
	const [mode, setMode] = useState<"login" | "register">("login")
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [name, setName] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)

	const handleSubmit = async () => {
		if (!username.trim() || !password.trim()) return
		setLoading(true)
		setError("")
		try {
			const result =
				mode === "login"
					? await auth.login(username.trim(), password)
					: await auth.register(username.trim(), password, name.trim())
			setTokens(result.access_token, result.refresh_token)
			onAuth(result)
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong")
		} finally {
			setLoading(false)
		}
	}

	const handleKey = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleSubmit()
	}

	return (
		<div className="login-wrap">
			<div className="login-card">
				<div className="login-logo">
					<span className="logo-icon">⚡</span>
					<span className="logo-text">FanoutFeed</span>
				</div>

				<div className="login-tabs">
					<button
						className={`login-tab ${mode === "login" ? "login-tab-active" : ""}`}
						onClick={() => {
							setMode("login")
							setError("")
						}}
					>
						Log in
					</button>
					<button
						className={`login-tab ${mode === "register" ? "login-tab-active" : ""}`}
						onClick={() => {
							setMode("register")
							setError("")
						}}
					>
						Register
					</button>
				</div>

				<div className="login-fields">
					<input
						className="login-input"
						placeholder="Username"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						onKeyDown={handleKey}
						autoFocus
					/>
					{mode === "register" && (
						<input
							className="login-input"
							placeholder="Display name (optional)"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKey}
						/>
					)}
					<input
						className="login-input"
						type="password"
						placeholder="Password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						onKeyDown={handleKey}
					/>
				</div>

				{error && <p className="login-error">{error}</p>}

				<button
					className="login-btn"
					onClick={handleSubmit}
					disabled={loading || !username.trim() || !password.trim()}
				>
					{loading ? "…" : mode === "login" ? "Log in" : "Create account"}
				</button>

				{mode === "login" && (
					<p className="login-hint">
						Seed accounts: alice, bob, carol, dave — password: <code>password123</code>
					</p>
				)}
			</div>
		</div>
	)
}
