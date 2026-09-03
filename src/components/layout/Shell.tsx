import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { TabBar } from "@/components/layout/TabBar"
import { useCobblemonEgg } from "@/lib/cobblemon/CobblemonEggProvider"

export function Shell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState()
  const { t } = useI18n()
  const { registerLogoClick, justUnlocked } = useCobblemonEgg()
  const PRIMARY = [
    { to: "/", label: "Dex", icon: "▦", title: t("dex.tabsHelp") },
    { to: "/moves", label: t("moves.title"), icon: "✦", title: t("moves.navDesc") },
  ] as const
  const REF = [
    { to: "/types", label: t("types.title"), icon: "◆", title: t("types.navDesc") },
    { to: "/items", label: t("items.title"), icon: "◇", title: t("items.navDesc") },
    { to: "/natures", label: t("natures.title"), icon: "◎", title: t("natures.navDesc") },
  ] as const
  const REST = [
    { to: "/compare", label: "Compare", icon: "⇄", title: t("compare.desc") },
    { to: "/teams", label: t("teams.title"), icon: "⬢", title: t("teams.desc") },
    { to: "/favorites", label: t("bookmarks.nav"), icon: "★", title: t("bookmarks.desc") },
    { to: "/settings", label: t("settings.title"), icon: "⚙" },
  ] as const

  const linkClass = (to: string) => {
    const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to))
    return cn(
      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
      active
        ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)]"
        : "text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-1000)]",
    )
  }

  return (
    <div className="h-full min-h-0 flex overflow-hidden bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)]">
      {/* Sidebar fixed left — 200px per ticket 12. Geist tokens, not Vercel top nav. */}
      <aside className="w-[200px] shrink-0 border-r border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] flex flex-col h-full">
        <div className="h-12 flex items-center px-4 border-b border-[var(--ds-gray-400)]">
          <span className="font-semibold tracking-tight">PokeStats</span>
          <span className="ml-auto text-xs text-[var(--ds-gray-700)]">v2</span>
        </div>

        <nav className="p-2 space-y-1">
          {[...PRIMARY].map((item) => (
            <Link key={item.to} to={item.to} title={(item as { title?: string }).title} className={linkClass(item.to)}>
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="pt-2 mt-1 border-t border-[var(--ds-gray-400)] space-y-1">
            {REF.map((item) => (
              <Link key={item.to} to={item.to} title={item.title} className={linkClass(item.to)}>
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-2 mt-1 border-t border-[var(--ds-gray-400)] space-y-1">
            {REST.map((item) => (
              <Link key={item.to} to={item.to} title={(item as { title?: string }).title} className={linkClass(item.to)}>
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="mt-auto border-t border-[var(--ds-gray-400)]">
          <div className="p-4 flex flex-col items-center">
            <button
              type="button"
              onClick={registerLogoClick}
              className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-blue-700)]"
            >
              <img
                src="/logo.png"
                alt="PokeStats"
                width={144}
                height={144}
                decoding="async"
                fetchPriority="high"
                className="w-36 h-36 object-contain select-none"
                style={{ background: "transparent" }}
              />
            </button>
            {justUnlocked ? (
              <p className="mt-2 text-[10px] text-center text-[var(--ds-gray-700)]">{t("cobblemon.unlocked")}</p>
            ) : null}
          </div>
          <div className="p-3 pt-0 text-xs text-[var(--ds-gray-700)] text-center">
            <div className="flex gap-1 justify-center">
              <kbd className="px-1 py-0.5 rounded border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]">Ctrl</kbd>
              <kbd className="px-1 py-0.5 rounded border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]">K</kbd>
              <span className="ml-1">{t("shell.palette")}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 flex flex-col">
        <TabBar />
        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
