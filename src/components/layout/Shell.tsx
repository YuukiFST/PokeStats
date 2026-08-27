import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

export function Shell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState()
  const { t } = useI18n()
  const NAV = [
    { to: "/", label: "Dex", icon: "▦", title: t("dex.tabsHelp") },
    { to: "/moves", label: t("moves.title"), icon: "✦", title: t("moves.navDesc") },
    { to: "/compare", label: "Compare", icon: "⇄", title: t("compare.desc") },
    { to: "/teams", label: t("teams.title"), icon: "⬢", title: t("teams.desc") },
    { to: "/settings", label: t("settings.title"), icon: "⚙" },
  ] as const

  return (
    <div className="min-h-screen flex bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)]">
      {/* Sidebar fixed left — 200px per ticket 12. Geist tokens, not Vercel top nav. */}
      <aside className="w-[200px] shrink-0 border-r border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] flex flex-col sticky top-0 h-screen">
        <div className="h-12 flex items-center px-4 border-b border-[var(--ds-gray-400)]">
          <span className="font-semibold tracking-tight">PokeStats</span>
          <span className="ml-auto text-xs text-[var(--ds-gray-700)]">v2</span>
        </div>

        <nav className="p-2 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))
            return (
              <Link
                key={item.to}
                to={item.to}
                title={(item as any).title}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)]"
                    : "text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-1000)]",
                )}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--ds-gray-400)]">
          <div className="p-4 flex flex-col items-center">
            <img src="/logo.png" alt="PokeStats" className="w-36 h-36 object-contain" style={{ background: "transparent" }} />
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

      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  )
}
