import { Link } from "@tanstack/react-router"
import { useDataset } from "@/hooks/useDataset"
import { useBookmarks } from "@/lib/bookmarks/BookmarksProvider"
import type { Bookmark } from "@/lib/bookmarks/store"
import { bookmarkKey } from "@/lib/bookmarks/store"
import { StarButton } from "@/components/ui/star"
import { SpriteThumb } from "@/components/ui/sprite"
import { Badge, TypeBadge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n"
import { moveIdForName } from "@/lib/dataset/load"

function FormRow({ formId }: { formId: string }) {
  const { t } = useI18n()
  const { data } = useDataset()
  const { has, toggle } = useBookmarks()
  const form = data?.formsById.get(formId)
  const ref = { kind: "form" as const, formId }
  if (!form) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-3 py-2 text-sm">
        <StarButton active onToggle={() => toggle(ref)} label={t("bookmarks.remove")} />
        <span className="min-w-0 truncate text-[var(--ds-gray-700)]">
          {formId} <span className="text-xs">{t("bookmarks.missing")}</span>
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-3 py-2 text-sm">
      <StarButton active={has(ref)} onToggle={() => toggle(ref)} label={t("bookmarks.remove")} />
      <SpriteThumb form={form} expandable={false} />
      <Link to="/form/$formId" params={{ formId } as never} className="min-w-0 truncate font-medium hover:underline">
        {form.name}
      </Link>
      <span className="ml-auto flex gap-1">
        {form.types.map((tt) => (
          <TypeBadge key={tt} type={tt} />
        ))}
      </span>
    </div>
  )
}

function MoveRow({ moveId }: { moveId: string }) {
  const { t } = useI18n()
  const { data } = useDataset()
  const { has, toggle } = useBookmarks()
  const ref = { kind: "move" as const, moveId }
  const info = data?.movesById.get(moveId) ?? data?.core.moves.find((m) => moveIdForName(m.name) === moveId)
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-3 py-2 text-sm">
      <StarButton active={has(ref)} onToggle={() => toggle(ref)} label={t("bookmarks.remove")} />
      <Link to="/moves/$moveId" params={{ moveId } as never} className="min-w-0 truncate font-medium hover:underline">
        {info?.name ?? moveId}
      </Link>
      {info ? <TypeBadge type={info.type} className="ml-auto h-[20px]" /> : <span className="ml-auto text-xs text-[var(--ds-gray-700)]">{t("bookmarks.missing")}</span>}
    </div>
  )
}

function TypeRow({ typeId }: { typeId: string }) {
  const { t, typeName } = useI18n()
  const { has, toggle } = useBookmarks()
  const ref = { kind: "type" as const, typeId }
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-3 py-2 text-sm">
      <StarButton active={has(ref)} onToggle={() => toggle(ref)} label={t("bookmarks.remove")} />
      <Link to="/types/$typeId" params={{ typeId } as never} className="font-medium hover:underline">
        {typeName(typeId)}
      </Link>
    </div>
  )
}

function SetRow({ item }: { item: Extract<Bookmark, { kind: "set" }> }) {
  const { t } = useI18n()
  const { data } = useDataset()
  const { toggle } = useBookmarks()
  const form = data?.formsById.get(item.formId)
  const set = data?.sets.sets.find(
    (s) => s.formId === item.formId && s.dexGen === item.dexGen && s.formatId === item.formatId && s.name === item.name,
  )
  const missing = !form || !set
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-3 py-2 text-sm">
      <StarButton active onToggle={() => toggle(item)} label={t("bookmarks.remove")} />
      {form ? <SpriteThumb form={form} expandable={false} /> : null}
      <div className="min-w-0">
        <Link
          to="/form/$formId"
          params={{ formId: item.formId } as never}
          search={{ tab: "sets" } as never}
          className="truncate font-medium hover:underline"
        >
          {form?.name ?? item.formId} · {item.name}
        </Link>
        <div className="text-xs text-[var(--ds-gray-700)]">
          {item.dexGen} • {item.formatId}
          {missing ? ` · ${t("bookmarks.missing")}` : ""}
        </div>
      </div>
      {set?.item ? <Badge className="ml-auto">{set.item}</Badge> : null}
    </div>
  )
}

export function FavoritesPage() {
  const { t } = useI18n()
  const { items } = useBookmarks()
  const forms = items.filter((b) => b.kind === "form")
  const sets = items.filter((b) => b.kind === "set")
  const moves = items.filter((b) => b.kind === "move")
  const types = items.filter((b) => b.kind === "type")

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("bookmarks.title")}</h1>
        <p className="mt-1 text-sm text-[var(--ds-gray-700)]">{t("bookmarks.desc")}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-8 text-center text-sm text-[var(--ds-gray-700)]">
          {t("bookmarks.empty")}
        </div>
      ) : (
        <>
          {forms.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t("bookmarks.forms")} <span className="text-[var(--ds-gray-700)] font-normal">{forms.length}</span></h2>
              {forms.map((b) => (
                <FormRow key={bookmarkKey(b)} formId={b.formId} />
              ))}
            </section>
          )}
          {sets.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t("bookmarks.sets")} <span className="text-[var(--ds-gray-700)] font-normal">{sets.length}</span></h2>
              {sets.map((b) => (
                <SetRow key={bookmarkKey(b)} item={b} />
              ))}
            </section>
          )}
          {moves.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t("bookmarks.moves")} <span className="text-[var(--ds-gray-700)] font-normal">{moves.length}</span></h2>
              {moves.map((b) => (
                <MoveRow key={bookmarkKey(b)} moveId={b.moveId} />
              ))}
            </section>
          )}
          {types.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">{t("bookmarks.types")} <span className="text-[var(--ds-gray-700)] font-normal">{types.length}</span></h2>
              {types.map((b) => (
                <TypeRow key={bookmarkKey(b)} typeId={b.typeId} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
