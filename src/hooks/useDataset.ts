import * as React from "react"
import { loadDataset, getDatasetSync, type LoadedDataset } from "@/lib/dataset/load"

export function useDataset() {
  const sync = getDatasetSync()
  const [data, setData] = React.useState<LoadedDataset | null>(sync)
  const [loading, setLoading] = React.useState(!sync)
  const [error, setError] = React.useState<unknown>(null)

  React.useEffect(() => {
    if (sync) return
    let cancelled = false
    loadDataset()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sync])

  // If sync appears after mount (preloaded), sync state
  React.useEffect(() => {
    if (sync && !data) {
      setData(sync)
      setLoading(false)
    }
  }, [sync, data])

  return { data, loading, error }
}
