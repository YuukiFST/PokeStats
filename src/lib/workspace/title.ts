import type { TranslationKey } from "@/lib/i18n"

/** Fallback labels when the dataset has not resolved a Form/move name yet. */
export function tabTitle(
  pathname: string,
  search: string,
  t: (k: TranslationKey) => string,
): string {
  if (pathname === "/") return t("workspace.dex")
  if (pathname === "/moves") return t("moves.title")
  if (pathname === "/compare") return t("workspace.compare")
  if (pathname === "/teams") return t("teams.title")
  if (pathname === "/settings") return t("settings.title")
  if (pathname === "/types") return t("types.title")
  if (pathname === "/items") return t("items.title")
  if (pathname === "/natures") return t("natures.title")
  const form = pathname.match(/^\/form\/([^/]+)$/)
  if (form) return decodeURIComponent(form[1]!)
  const move = pathname.match(/^\/moves\/([^/]+)$/)
  if (move) return decodeURIComponent(move[1]!)
  const item = pathname.match(/^\/items\/([^/]+)$/)
  if (item) return decodeURIComponent(item[1]!)
  const typ = pathname.match(/^\/types\/([^/]+)$/)
  if (typ) return decodeURIComponent(typ[1]!)
  return pathname + search
}
