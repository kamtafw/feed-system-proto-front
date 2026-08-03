/* eslint-disable react-hooks/refs */
/**
 * useInfiniteScroll — fires a callback when a sentinel element scrolls
 * into view. Used to trigger loadMore() near the bottom of the feed.
 *
 * Usage:
 *   const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loadingMore)
 *   ...
 *   {hasMore && <div ref={sentinelRef} />}
 *
 * `enabled` gates observation entirely: pass `hasMore && !loadingMore` so
 * we never fire a second load while one is in flight, and stop observing
 * once the feed is exhausted. A callback ref (not useRef + useEffect) is
 * used deliberately — the sentinel node mounts/unmounts as `hasMore`
 * toggles, and callback refs fire reliably on that transition; a fixed
 * ref object wouldn't re-trigger observer setup when the DOM node changes.
 */

import { useCallback, useEffect, useRef } from "react"

export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(
	onIntersect: () => void,
	enabled: boolean,
) {
	const cbRef = useRef(onIntersect)
	cbRef.current = onIntersect

	const observerRef = useRef<IntersectionObserver | null>(null)

	const sentinelRef = useCallback(
		(node: T | null) => {
			observerRef.current?.disconnect()
			observerRef.current = null

			if (!node || !enabled) return

			observerRef.current = new IntersectionObserver(
				(entries) => {
					if (entries[0]?.isIntersecting) cbRef.current()
				},
				{ rootMargin: "200px" }, // start loading just before the sentinel is actually visible
			)
			observerRef.current.observe(node)
		},
		[enabled],
	)

	useEffect(() => {
		return () => observerRef.current?.disconnect()
	}, [])

	return sentinelRef
}