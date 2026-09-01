import * as React from "react"
import {
  BOOKMARKS_KEY,
  hasBookmark,
  parseBookmarks,
  serializeBookmarks,
  toggleBookmark,
  type Bookmark,
  type BookmarkRef,
} from "./store"

type Api = {
  items: Bookmark[]
  has: (ref: BookmarkRef) => boolean
  toggle: (ref: BookmarkRef) => void
}

const Ctx = React.createContext<Api | null>(null)

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Bookmark[]>(() => {
    try {
      return parseBookmarks(localStorage.getItem(BOOKMARKS_KEY))
    } catch {
      return []
    }
  })

  React.useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, serializeBookmarks(items))
    } catch {}
  }, [items])

  const has = React.useCallback((ref: BookmarkRef) => hasBookmark(items, ref), [items])
  const toggle = React.useCallback((ref: BookmarkRef) => {
    setItems((prev) => toggleBookmark(prev, ref))
  }, [])

  const value = React.useMemo(() => ({ items, has, toggle }), [items, has, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useBookmarks(): Api {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error("useBookmarks outside BookmarksProvider")
  return ctx
}
