/**
 * config.ts — backend URL configuration.
 *
 * VITE_API_BASE controls which backend instance this frontend tab talks to.
 * Set it before starting the dev server:
 *
 *   PowerShell:
 *     $env:VITE_API_BASE="http://localhost:8001"; npm run dev
 *
 *   bash/zsh:
 *     VITE_API_BASE=http://localhost:8001 npm run dev
 *
 * Default (no env var): http://localhost:8000
 *
 * The WebSocket base is derived automatically by swapping the scheme:
 *   http://localhost:8001  →  ws://localhost:8001
 *   https://example.com   →  wss://example.com
 */

export const HTTP_BASE: string = import.meta.env.VITE_API_BASE ?? "http://localhost:8000"

export const WS_BASE: string = HTTP_BASE.replace(/^http/, "ws")
