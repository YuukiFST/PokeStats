import * as React from "react"
import { loadDataset, getDatasetSync, subscribeDataset, type LoadedDataset } from "@/lib/dataset/load"

export function useDataset() {
  const [, setTick] = React.useState(0)
  const [error, setError] = React.useState<unknown>(null)
  const data: LoadedDataset | null = getDatasetSync()

  React.useEffect(() => {
    const unsub = subscribeDataset(() => setTick((n) => n + 1))
    if (!getDatasetSync()) {
      loadDataset().catch((e) => setError(e))
    }
    return unsub
  }, [])

  return {
    data,
    loading: !data && !error,
    error,
    extrasReady: data?.extrasReady ?? false,
    catalogReady: data?.catalogReady ?? false,
  }
}
