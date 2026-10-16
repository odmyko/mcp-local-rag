// Text Embeddings Inference `/rerank`. A failure keeps the caller's order.

import { isInteger, isRecord } from '../utils/type-guards.js'
import type { RerankResult } from './response.js'

/** One HTTP rerank call against a Text Embeddings Inference server. */
export interface HttpRerankRequest {
  /** Search results in their pre-rerank order. Returned as-is on failure. */
  candidates: RerankResult[]
  /** Query text sent to the reranker. */
  query: string
  /** Maximum number of results to return. */
  top: number
  /** Server origin. The request goes to `{baseUrl}/rerank`. */
  baseUrl: string
  /** Per-call budget. */
  timeoutMs: number
}

interface RankedRow {
  index: number
  score: number
}

function isRankedRow(value: unknown): value is RankedRow {
  if (!isRecord(value)) {
    return false
  }
  return (
    isInteger(value['index']) &&
    typeof value['score'] === 'number' &&
    Number.isFinite(value['score'])
  )
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return 'request timed out'
  }
  return error instanceof Error ? error.message : String(error)
}

function fallback(candidates: RerankResult[], reason: string): RerankResult[] {
  console.error(`Rerank: ${reason}; returning the pre-rerank ordering`)
  return candidates
}

function orderByScore(
  candidates: RerankResult[],
  ranked: RankedRow[],
  top: number
): RerankResult[] {
  const sorted = [...ranked].sort((left, right) => right.score - left.score)
  const ordered: RerankResult[] = []
  const seen = new Set<number>()
  for (const row of sorted) {
    if (ordered.length >= top) {
      break
    }
    if (row.index < 0 || row.index >= candidates.length || seen.has(row.index)) {
      continue
    }
    const item = candidates[row.index]
    if (!item) {
      continue
    }
    seen.add(row.index)
    ordered.push({ ...item, score: ordered.length / sorted.length, rerankScore: row.score })
  }
  return ordered
}

/**
 * Ask a Text Embeddings Inference server to reorder `candidates`. The returned
 * `score` is the rank in this response, so a lower value is better. `rerankScore`
 * keeps the service's own score. Never throws.
 */
export async function rerankWithHttp(request: HttpRerankRequest): Promise<RerankResult[]> {
  const { candidates, query, top, baseUrl, timeoutMs } = request
  if (candidates.length === 0 || top < 1) {
    return candidates
  }

  const endpoint = `${baseUrl}/rerank`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        texts: candidates.map((candidate) => (candidate.text.length > 0 ? candidate.text : ' ')),
        truncate: true,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    return fallback(candidates, `the rerank request to ${endpoint} failed: ${errorMessage(error)}`)
  }
  if (!response.ok) {
    return fallback(
      candidates,
      `the rerank request to ${endpoint} failed with HTTP ${response.status}`
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return fallback(candidates, `the rerank response from ${endpoint} is not valid JSON`)
  }
  if (!Array.isArray(payload) || !payload.every(isRankedRow)) {
    return fallback(candidates, `the rerank response from ${endpoint} has an invalid ranking`)
  }
  return orderByScore(candidates, payload, top)
}
