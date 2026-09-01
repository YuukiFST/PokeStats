import * as React from "react"
import { EGG_CLICKS, EGG_STORAGE_KEY, EGG_SLOT_KEY, nextLogoClicks, parsePartySlot } from "./egg"

type Api = {
  unlocked: boolean
  justUnlocked: boolean
  slot: number
  setSlot: (n: number) => void
  registerLogoClick: () => void
}

const Ctx = React.createContext<Api | null>(null)

export function CobblemonEggProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = React.useState(false)
  const [justUnlocked, setJustUnlocked] = React.useState(false)
  const [slot, setSlotState] = React.useState(() => {
    try {
      return parsePartySlot(localStorage.getItem(EGG_SLOT_KEY))
    } catch {
      return 1
    }
  })
  const streak = React.useRef({ count: 0, lastAt: 0 })

  React.useEffect(() => {
    try {
      localStorage.removeItem(EGG_STORAGE_KEY)
    } catch {}
  }, [])

  const setSlot = React.useCallback((n: number) => {
    const next = parsePartySlot(String(n))
    setSlotState(next)
    try {
      localStorage.setItem(EGG_SLOT_KEY, String(next))
    } catch {}
  }, [])

  const registerLogoClick = React.useCallback(() => {
    if (unlocked) return
    const now = Date.now()
    const count = nextLogoClicks(streak.current.count, streak.current.lastAt, now)
    streak.current = { count, lastAt: now }
    if (count < EGG_CLICKS) return
    setUnlocked(true)
    setJustUnlocked(true)
    window.setTimeout(() => setJustUnlocked(false), 2400)
  }, [unlocked])

  const value = React.useMemo(
    () => ({ unlocked, justUnlocked, slot, setSlot, registerLogoClick }),
    [unlocked, justUnlocked, slot, setSlot, registerLogoClick],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCobblemonEgg(): Api {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error("useCobblemonEgg outside CobblemonEggProvider")
  return ctx
}
