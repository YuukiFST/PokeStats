import * as React from "react"
import { useI18n } from "@/lib/i18n"

export function SettingsPage() {
  const { lang, setLang, t } = useI18n()
  const [theme, setTheme] = React.useState<string>(() => localStorage.getItem("pokestats:theme") ?? "dark")

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("pokestats:theme", theme)
  }, [theme])

  return (
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-lg font-semibold">{t("settings.title")}</h1>

      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("settings.theme")}</div>
            <div className="text-xs text-[var(--ds-gray-700)]">{t("settings.themeDesc")}</div>
          </div>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm">
            <option value="dark">{t("settings.dark")}</option>
            <option value="light">{t("settings.light")}</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{t("settings.language")}</div>
            <div className="text-xs text-[var(--ds-gray-700)]">{t("settings.languageDesc")}</div>
          </div>
          <select value={lang} onChange={(e) => setLang(e.target.value as never)} className="h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm">
            <option value="en">{t("settings.english")}</option>
            <option value="pt-BR">{t("settings.portuguese")}</option>
          </select>
        </div>
      </div>
    </div>
  )
}
