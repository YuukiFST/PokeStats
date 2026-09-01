import { useNavigate, useSearch } from "@tanstack/react-router"
import { TypeModeBar, TypeStage } from "@/components/types/TypeStage"
import type { TypeName } from "@/lib/domain/types"
import { TYPE_NAMES } from "@/lib/domain/typeChart"
import { useI18n } from "@/lib/i18n"

export type TypesSearch = {
  t?: string
  view?: string
}

function parseSelected(raw?: string): TypeName[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TypeName => TYPE_NAMES.includes(s as TypeName))
    .slice(0, 2)
}

export function TypesPage() {
  const search = useSearch({ strict: false }) as TypesSearch
  const navigate = useNavigate()
  const { t } = useI18n()
  const selected = parseSelected(search.t)
  const attack = search.view === "chart" && selected.length > 0

  const setSelected = (next: TypeName[], nextAttack = attack) => {
    navigate({
      to: "/types",
      search: {
        t: next.length ? next.join(",") : undefined,
        view: nextAttack && next.length ? "chart" : undefined,
      } as never,
    })
  }

  const toggle = (tt: TypeName) => {
    if (selected.includes(tt)) setSelected(selected.filter((x) => x !== tt))
    else if (selected.length < 2) setSelected([...selected, tt])
    else setSelected([selected[0]!, tt])
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#050505]">
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-white/5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{t("types.title")}</div>
          <p className="text-xs text-white/55 mt-0.5">{t("types.desc")}</p>
        </div>
        <TypeModeBar
          attack={attack}
          canAttack={selected.length > 0}
          onDefend={() => setSelected(selected, false)}
          onAttack={() => setSelected(selected, true)}
        />
      </div>
      <div className="flex-1 min-h-0">
        <TypeStage selected={selected} attack={attack} onToggle={toggle} onClear={() => setSelected([])} />
      </div>
    </div>
  )
}
