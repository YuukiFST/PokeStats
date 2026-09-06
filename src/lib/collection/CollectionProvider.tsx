import * as React from "react"
import {
  COLLECTION_KEY,
  entryFor,
  parseCollection,
  serializeCollection,
  toggleFlag,
  type CollectionEntry,
  type CollectionFlag,
} from "./store"

type Api = {
  entries: CollectionEntry[]
  entry: (formId: string) => CollectionEntry
  ownedIds: Set<string>
  toggle: (formId: string, flag: CollectionFlag) => void
}

const Ctx = React.createContext<Api | null>(null)

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<CollectionEntry[]>(() => {
    try {
      return parseCollection(localStorage.getItem(COLLECTION_KEY))
    } catch {
      return []
    }
  })

  React.useEffect(() => {
    try {
      localStorage.setItem(COLLECTION_KEY, serializeCollection(entries))
    } catch {}
  }, [entries])

  const entry = React.useCallback((formId: string) => entryFor(entries, formId), [entries])
  const ownedIds = React.useMemo(
    () => new Set(entries.filter((e) => e.owned).map((e) => e.formId)),
    [entries],
  )
  const toggle = React.useCallback((formId: string, flag: CollectionFlag) => {
    setEntries((prev) => toggleFlag(prev, formId, flag))
  }, [])

  const value = React.useMemo(() => ({ entries, entry, ownedIds, toggle }), [entries, entry, ownedIds, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCollection(): Api {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error("useCollection outside CollectionProvider")
  return ctx
}
