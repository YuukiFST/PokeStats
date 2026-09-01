import * as React from "react"
import { useDataset } from "@/hooks/useDataset"
import { moveIdForName } from "@/lib/dataset/load"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CloseIcon, PlusIcon } from "@/components/ui/icons"
import { SpriteThumb } from "@/components/ui/sprite"
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider"
import { tabTitle } from "@/lib/workspace/title"
import type { LocationSnapshot } from "@/lib/workspace/state"

function useTabMeta(loc: LocationSnapshot): { label: string; glyph: React.ReactNode } {
  const { t, typeName } = useI18n()
  const { data } = useDataset()
  const fallback = tabTitle(loc.pathname, loc.search, t)
  const formMatch = loc.pathname.match(/^\/form\/([^/]+)$/)
  if (formMatch) {
    const id = decodeURIComponent(formMatch[1]!)
    const form = data?.formsById.get(id)
    return {
      label: form?.name ?? fallback,
      glyph: form ? <SpriteThumb form={form} size={18} expandable={false} /> : <span className="text-[13px] leading-none opacity-80">●</span>,
    }
  }
  const moveMatch = loc.pathname.match(/^\/moves\/([^/]+)$/)
  if (moveMatch) {
    const id = decodeURIComponent(moveMatch[1]!)
    const found = data?.core.moves.find((m) => moveIdForName(m.name) === id)
    return { label: found?.name ?? fallback, glyph: <span className="text-[13px] leading-none opacity-80">✦</span> }
  }
  const itemMatch = loc.pathname.match(/^\/items\/([^/]+)$/)
  if (itemMatch) {
    const id = decodeURIComponent(itemMatch[1]!)
    const found = data?.itemsById.get(id)
    return { label: found?.name ?? fallback, glyph: <span className="text-[13px] leading-none opacity-80">◇</span> }
  }
  const typeMatch = loc.pathname.match(/^\/types\/([^/]+)$/)
  if (typeMatch) return { label: typeName(decodeURIComponent(typeMatch[1]!)), glyph: <span className="text-[13px] leading-none opacity-80">◆</span> }
  if (loc.pathname === "/") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">▦</span> }
  if (loc.pathname === "/moves") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">✦</span> }
  if (loc.pathname === "/types") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">◆</span> }
  if (loc.pathname === "/items") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">◇</span> }
  if (loc.pathname === "/natures") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">◎</span> }
  if (loc.pathname === "/compare") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">⇄</span> }
  if (loc.pathname === "/teams") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">⬢</span> }
  if (loc.pathname === "/favorites") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">★</span> }
  if (loc.pathname === "/settings") return { label: fallback, glyph: <span className="text-[13px] leading-none opacity-80">⚙</span> }
  return { label: fallback, glyph: null }
}

function TabChip({ loc }: { loc: LocationSnapshot }) {
  const { label, glyph } = useTabMeta(loc)
  return (
    <>
      <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center">{glyph}</span>
      <span className="truncate">{label}</span>
    </>
  )
}

export function TabBar() {
  const { t } = useI18n()
  const { tabs, activeId, activate, close, newTab } = useWorkspace()

  return (
    <div
      className="shrink-0 flex items-end h-9 pl-1.5 pr-2 gap-0.5 border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] z-10"
      role="tablist"
      aria-label={t("workspace.tabs")}
    >
      <div className="workspace-tab-strip w-max max-w-[calc(100%-2rem)] flex items-end">
        <div className="flex items-end gap-0.5">
          {tabs.map((tab) => {
            const loc = tab.entries[tab.index]!
            const active = tab.id === activeId
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                className={cn(
                  "group relative inline-flex items-center gap-1 h-[30px] w-max max-w-[220px] min-w-0 overflow-hidden pl-2 pr-0.5 rounded-t-md text-[12px] cursor-pointer select-none border border-transparent",
                  active
                    ? "-mb-px border-[var(--ds-gray-400)] border-b-[var(--ds-background-100)] bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)]"
                    : "text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-1000)]",
                )}
                onClick={() => activate(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    activate(tab.id)
                  }
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    close(tab.id)
                  }
                }}
              >
                <TabChip loc={loc} />
                <button
                  type="button"
                  title={t("workspace.closeTab")}
                  className={cn(
                    "shrink-0 w-[18px] h-[18px] rounded-sm inline-flex items-center justify-center text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-400)] hover:text-[var(--ds-gray-1000)]",
                    active ? "opacity-70" : "opacity-0 group-hover:opacity-70",
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    close(tab.id)
                  }}
                >
                  <CloseIcon size={11} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        title={t("workspace.newTab")}
        aria-label={t("workspace.newTab")}
        className="shrink-0 mb-0.5 w-7 h-7 rounded-md inline-flex items-center justify-center text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-1000)]"
        onClick={newTab}
      >
        <PlusIcon size={15} />
      </button>
    </div>
  )
}
