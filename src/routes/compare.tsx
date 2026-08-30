import * as React from "react"
import { useSearch, Link } from "@tanstack/react-router"
import { useWorkspace } from "@/lib/workspace/WorkspaceProvider"
import { useDataset } from "@/hooks/useDataset"
import { TypeBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HelpTip } from "@/components/ui/helptip"
import { calcBST } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { Sprite } from "@/components/ui/sprite"

// stat keys displayed — BST is NOT here on purpose: it is a derived total,
// not a stat, so it never competes for wins/ties (see totals section below).
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const
type StatKey = typeof STAT_KEYS[number]

const COLORS = [
  { stroke: "var(--ds-blue-700)", fill: "var(--ds-blue-700)", bg: "var(--ds-blue-700)", soft: "rgba(0,113,246,0.12)" },
  { stroke: "var(--ds-green-700)", fill: "var(--ds-green-700)", bg: "var(--ds-green-700)", soft: "rgba(0,171,62,0.12)" },
  { stroke: "var(--ds-amber-700)", fill: "var(--ds-amber-700)", bg: "var(--ds-amber-700)", soft: "rgba(255,178,0,0.12)" },
  { stroke: "var(--ds-purple-700)", fill: "var(--ds-purple-700)", bg: "var(--ds-purple-700)", soft: "rgba(148,64,213,0.12)" },
]

function Radar({ forms, max = 255 }: { forms: { baseStats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } }[]; max?: number }) {
  const size = 220
  const cx = 110, cy = 110, r = 80
  const axes = STAT_KEYS.length
  const angleStep = (Math.PI * 2) / axes
  // helper to get point for stat index and value 0..max
  const point = (i: number, v: number) => {
    const rr = (v / max) * r
    const ang = -Math.PI / 2 + i * angleStep
    return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr] as const
  }
  // grid polygons
  const grid = [0.5, 1].map((scale) => STAT_KEYS.map((_, i) => point(i, max * scale).join(",")).join(" "))
  const axisLines = STAT_KEYS.map((_, i) => {
    const [x, y] = point(i, max)
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--ds-gray-400)" strokeWidth={0.8} opacity={0.6} />
  })
  const labels = STAT_KEYS.map((k, i) => {
    const [x, y] = point(i, max * 1.15)
    return (
      <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={600} fill="var(--ds-gray-900)" style={{ textTransform: "uppercase" }}>
        {k}
      </text>
    )
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {/* grid */}
      {grid.map((pts, idx) => (
        <polygon key={idx} points={pts} fill="none" stroke="var(--ds-gray-400)" strokeWidth={1} opacity={idx === 1 ? 0.9 : 0.45} strokeDasharray={idx === 0 ? "4 4" : undefined} />
      ))}
      {axisLines}
      {/* polygons per form */}
      {forms.map((f, fi) => {
        const c = COLORS[fi % COLORS.length]!
        const pts = STAT_KEYS.map((k, i) => point(i, f.baseStats[k] as number).join(",")).join(" ")
        const dots = STAT_KEYS.map((k, i) => {
          const [x, y] = point(i, f.baseStats[k] as number)
          return <circle key={k} cx={x} cy={y} r={3} fill={c.fill} stroke="var(--ds-background-100)" strokeWidth={1.2} />
        })
        return (
          <g key={fi}>
            <polygon points={pts} fill={c.soft} stroke={c.stroke} strokeWidth={2} opacity={0.95} />
            {dots}
          </g>
        )
      })}
      {labels}
    </svg>
  )
}

export function ComparePage() {
  const search = useSearch({ strict: false }) as { ids?: string }
  const ids = React.useMemo(() => (search.ids ? search.ids.split(",").filter(Boolean).slice(0, 4) : []), [search.ids])
  const { data } = useDataset()
  const { t, typeName } = useI18n()
  const { back } = useWorkspace()
  const handleBack = React.useCallback(() => {
    back()
  }, [back])

  if (ids.length === 0) {
    return (
      <div className="p-8 space-y-3">
        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-6 text-sm text-[var(--ds-gray-700)]">
          {t("compare.select")}
        </div>
        <button onClick={handleBack} className="inline-flex h-8 items-center rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-3 text-sm hover:bg-[var(--ds-gray-100)]">
          {t("compare.back")}
        </button>
        <div className="text-xs text-[var(--ds-gray-700)]">{t("compare.spriteNote")}</div>
      </div>
    )
  }

  const forms = ids.map((id) => data?.formsById.get(id)).filter(Boolean) as NonNullable<ReturnType<NonNullable<typeof data>["formsById"]["get"]>>[]
  if (forms.length === 0) {
    return <div className="p-8 text-sm text-[var(--ds-gray-700)]">No Forms resolved for {ids.join(", ")}.</div>
  }

  // compute per-stat leaders (six real stats only)
  const statRows: { key: StatKey; label: string; values: number[]; max: number; winners: number[]; isTie: boolean }[] = []
  for (const k of STAT_KEYS) {
    const values = forms.map((f) => f.baseStats[k] as number)
    const max = Math.max(...values)
    const winners = values.map((v, i) => (v === max ? i : -1)).filter((i) => i !== -1)
    const isTie = winners.length > 1
    statRows.push({ key: k, label: k.toUpperCase(), values, max, winners, isTie })
  }

  // wins per form
  const wins = forms.map((_, idx) => {
    let sole = 0, tie = 0
    for (const r of statRows) {
      if (r.winners.includes(idx)) {
        if (r.isTie) tie++
        else sole++
      }
    }
    return { sole, tie, total: sole + tie }
  })
  const overallMaxWins = Math.max(...wins.map((w) => w.total))

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {t("compare.title")} {forms.length} {t("compare.forms")}
          </h1>
          <p className="text-xs leading-tight text-[var(--ds-gray-700)] max-w-[680px] mt-1">{t("compare.desc")}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleBack}>
            {t("compare.clearSelection")}
          </Button>
          <button onClick={handleBack} className="inline-flex h-8 items-center rounded-md bg-[var(--ds-gray-1000)] text-[var(--ds-background-100)] px-3 text-sm font-medium hover:opacity-90">
            {t("compare.back")}
          </button>
        </div>
      </div>

      {/* cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${forms.length}, minmax(0, 1fr))` }}>
        {forms.map((f, idx) => {
          const c = COLORS[idx % COLORS.length]!
          const w = wins[idx]!
          const isOverallLeader = w.total === overallMaxWins && w.total > 0
          const bst = calcBST(f.baseStats)
          return (
            <div
              key={f.id}
              className={`rounded-md border bg-[var(--ds-background-200)] p-4 flex flex-col items-center text-center gap-2 ${isOverallLeader ? "border-[var(--ds-blue-700)] ring-1 ring-[var(--ds-blue-700)]" : "border-[var(--ds-gray-400)]"}`}
              style={{ borderTopColor: c.stroke, borderTopWidth: 3 }}
            >
              <Sprite form={f} size="lg" />
              <Link to="/form/$formId" params={{ formId: f.id } as never} className="font-semibold hover:underline leading-tight">
                {f.name}
              </Link>
              <div className="flex gap-1 flex-wrap justify-center">
                {f.types.map((tt) => (
                  <TypeBadge key={tt} type={tt} />
                ))}
              </div>
              <div className="text-xs text-[var(--ds-gray-700)] font-mono">
                #{String(f.speciesId).padStart(4, "0")} • {f.types.map(typeName).join(" / ")} {f.tier ? `• Tier ${f.tier}` : ""}
              </div>
              <div className="flex items-center gap-1 text-sm tnum">
                <span className="text-[var(--ds-gray-700)]">BST</span>
                <HelpTip text={t("glossary.bst")} />
                <span className="font-semibold">{bst}</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${isOverallLeader ? "bg-[var(--ds-blue-700)] text-white border-[var(--ds-blue-700)]" : "bg-[var(--ds-gray-100)] border-[var(--ds-gray-400)] text-[var(--ds-gray-900)]"}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: c.bg }} />
                {w.sole} {t("compare.wins")} • {w.tie} {t("compare.ties")}
                {isOverallLeader && <span className="ml-1">★</span>}
              </div>
              <div className="text-[10px] text-[var(--ds-gray-700)]">
                {forms.length > 1 && w.total === 0 ? t("compare.lowest") : isOverallLeader ? `${t("compare.leader")} • ${t("compare.highest")}` : ""}
              </div>
            </div>
          )
        })}
      </div>

      {/* radar + summary */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 flex flex-col items-center gap-3">
          <div className="text-sm font-semibold self-start">{t("compare.radar")} · 6 stats · max 255</div>
          <Radar forms={forms} />
          <div className="flex flex-wrap gap-2 justify-center text-xs">
            {forms.map((f, i) => {
              const c = COLORS[i % COLORS.length]!
              return (
                <span key={f.id} className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.bg }} />
                  <span>{f.name}</span>
                </span>
              )
            })}
          </div>
          <div className="text-[11px] text-[var(--ds-gray-700)] text-center leading-tight">
            {t("compare.spriteNote")}
          </div>
        </div>

        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
          <div className="text-sm font-semibold mb-3">{t("compare.summary")}</div>
          {/* one shared grid so the name column sizes to the longest name and bars stay aligned */}
          <div className="grid gap-2 items-center" style={{ gridTemplateColumns: "max-content minmax(0, 1fr) max-content" }}>
            {forms.map((f, idx) => {
              const c = COLORS[idx % COLORS.length]!
              const w = wins[idx]!
              const barPct = overallMaxWins ? (w.total / overallMaxWins) * 100 : 0
              return (
                <React.Fragment key={f.id}>
                  <span className="font-medium flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.bg }} />
                    {f.name}
                  </span>
                  <div className="h-2.5 rounded-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: c.bg }} />
                  </div>
                  <span className="text-right tnum text-xs text-[var(--ds-gray-700)] whitespace-nowrap">
                    {w.sole} ★ · {w.tie} =
                  </span>
                </React.Fragment>
              )
            })}
          </div>
          <div className="mt-4 text-xs text-[var(--ds-gray-700)]">
            {t("compare.leader")}: <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--ds-blue-700)] inline-block" /> {t("compare.sole")} (★)</span> ·{" "}
            <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded border border-dashed border-amber-600 bg-amber-500/15 inline-block" /> {t("compare.tie")} (=)</span>
          </div>
        </div>
      </div>

      {/* stat table */}
      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)]">
          <h2 className="text-sm font-semibold">{t("compare.table")} · {t("compare.bars")}</h2>
          <span className="text-xs text-[var(--ds-gray-700)] ml-2">max por linha destacado · empate tracejado</span>
          <span className="ml-auto text-xs text-[var(--ds-gray-700)]">★ {t("compare.leader")} · = {t("compare.tie")}</span>
        </div>

        {/* header row */}
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid gap-2 px-4 py-2 text-xs font-medium text-[var(--ds-gray-900)] border-b border-[var(--ds-gray-200)] bg-[var(--ds-gray-100)]" style={{ gridTemplateColumns: `80px repeat(${forms.length}, minmax(0, 1fr))` }}>
              <span>STAT</span>
              {forms.map((f) => (
                <span key={f.id} className="truncate text-center">
                  {f.name}
                </span>
              ))}
            </div>

            {statRows.map((row) => (
              <div key={row.key} className="grid gap-2 px-4 py-2 items-center border-b border-[var(--ds-gray-200)] last:border-0" style={{ gridTemplateColumns: `80px repeat(${forms.length}, minmax(0, 1fr))` }}>
                <div className="text-xs font-semibold uppercase tracking-wide flex flex-col">
                  <span>{row.label}</span>
                  <span className="text-[10px] font-normal text-[var(--ds-gray-700)]">max {row.max}</span>
                </div>
                {row.values.map((v, idx) => {
                  const isWinner = row.winners.includes(idx)
                  const isSole = isWinner && !row.isTie
                  const isTie = isWinner && row.isTie
                  const pct = row.max ? (v / row.max) * 100 : 0
                  const delta = v - row.max // 0 for winners, negative otherwise
                  const c = COLORS[idx % COLORS.length]!
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border px-2 py-2 flex flex-col gap-1.5 ${isSole ? "bg-[var(--ds-blue-700)] text-white border-[var(--ds-blue-700)]" : isTie ? "bg-amber-500/10 border-dashed border-amber-600 text-[var(--ds-gray-1000)]" : "bg-[var(--ds-background-200)] border-[var(--ds-gray-400)]"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`tnum text-sm font-semibold ${isSole ? "text-white" : ""}`}>{v}</span>
                        <span className={`text-[11px] inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-bold ${isSole ? "bg-white text-[var(--ds-blue-700)] border-white" : isTie ? "bg-amber-500 text-white border-amber-600" : "bg-transparent border-[var(--ds-gray-400)] text-[var(--ds-gray-700)] opacity-60"}`}>
                          {isSole ? "★" : isTie ? "=" : "·"}
                        </span>
                      </div>
                      <div className={`h-1.5 rounded overflow-hidden border ${isSole ? "bg-white/20 border-white/30" : isTie ? "bg-amber-900/10 border-amber-600/20" : "bg-[var(--ds-gray-100)] border-[var(--ds-gray-400)]"}`}>
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${pct}%`,
                            background: isSole ? "#fff" : isTie ? "var(--ds-amber-600)" : c.bg,
                            opacity: isWinner ? 1 : 0.85,
                          }}
                        />
                      </div>
                      <div className={`text-[10px] tnum ${isSole ? "text-white/90" : isTie ? "text-amber-700" : "text-[var(--ds-gray-700)]"}`}>
                        {isWinner ? (isTie ? `${t("compare.tie")} · ${t("compare.shared")}` : `${t("compare.leader")} · ${t("compare.sole")}`) : `${t("compare.delta")} ${delta}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* totals — derived context only, never competes with stats */}
      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)]">
          <h2 className="text-sm font-semibold">{t("compare.total")}</h2>
          <HelpTip text={t("glossary.bst")} />
        </div>
        <div className="p-4 space-y-2">
          {(() => {
            const bsts = forms.map((f) => calcBST(f.baseStats))
            const maxBst = Math.max(...bsts)
            return (
              <div className="grid gap-2 items-center" style={{ gridTemplateColumns: "max-content minmax(0, 1fr) max-content" }}>
                {forms.map((f, idx) => {
                  const c = COLORS[idx % COLORS.length]!
                  const bst = bsts[idx]!
                  return (
                    <React.Fragment key={f.id}>
                      <span className="font-medium flex items-center gap-1.5 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.bg }} />
                        {f.name}
                      </span>
                      <div className="h-2.5 rounded-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] overflow-hidden">
                        <div className="h-full rounded-full opacity-50" style={{ width: `${maxBst ? (bst / maxBst) * 100 : 0}%`, background: c.bg }} />
                      </div>
                      <span className="text-right tnum text-xs">{bst}</span>
                    </React.Fragment>
                  )
                })}
              </div>
            )
          })()}
          <div className="text-xs text-[var(--ds-gray-700)] pt-1">{t("compare.totalCaption")}</div>
        </div>
      </div>

      <div className="text-xs text-[var(--ds-gray-700)]">
        {t("compare.addMore")} — <Link to="/" className="underline text-[var(--ds-blue-700)]">Dex</Link>. {t("compare.spriteNote")}
      </div>
    </div>
  )
}
