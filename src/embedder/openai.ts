import { isInteger, isRecord } from '../utils/type-guards.js'
import type { EmbeddingRole } from './index.js'

export interface OpenAIEmbedderConfig {
  baseUrl: string
  apiKey?: string
  model: string
  timeoutMs: number
  titlePrefix?: boolean
  headingPrefix?: boolean
}

interface EmbeddingRow {
  embedding: number[]
  index: number
}

function isEmbeddingRow(value: unknown): value is EmbeddingRow {
  if (!isRecord(value)) {
    return false
  }
  return (
    isInteger(value['index']) &&
    Array.isArray(value['embedding']) &&
    value['embedding'].every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error('OpenAI embedding response contains a zero-length vector')
  }
  return vector.map((value) => value / magnitude)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return 'request timed out'
  }
  return error instanceof Error ? error.message : String(error)
}

function completeVectors(values: (number[] | undefined)[]): values is number[][] {
  return values.every((value): value is number[] => value !== undefined)
}

function parseEmbeddingResponse(payload: unknown, count: number, endpoint: string): number[][] {
  const data = isRecord(payload) ? payload['data'] : undefined
  if (!Array.isArray(data) || data.length !== count || !data.every(isEmbeddingRow)) {
    throw new Error(`OpenAI embeddings response from ${endpoint} has an invalid data array`)
  }

  const ordered: (number[] | undefined)[] = Array.from({ length: count })
  let dimension: number | null = null
  for (const row of data) {
    if (row.index < 0 || row.index >= count || ordered[row.index] !== undefined) {
      throw new Error(`OpenAI embeddings response from ${endpoint} has invalid indexes`)
    }
    if (row.embedding.length === 0 || (dimension !== null && row.embedding.length !== dimension)) {
      throw new Error(`OpenAI embeddings response from ${endpoint} has inconsistent dimensions`)
    }
    dimension = row.embedding.length
    ordered[row.index] = normalize(row.embedding)
  }
  if (!completeVectors(ordered)) {
    throw new Error(`OpenAI embeddings response from ${endpoint} omitted an index`)
  }
  return ordered
}

async function requestEmbeddings(
  config: OpenAIEmbedderConfig,
  endpoint: string,
  texts: string[]
): Promise<unknown> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (config.apiKey) {
    headers['authorization'] = `Bearer ${config.apiKey}`
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: config.model, input: texts }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  } catch (error) {
    throw new Error(`OpenAI embeddings request to ${endpoint} failed: ${errorMessage(error)}`, {
      cause: error,
    })
  }
  if (!response.ok) {
    throw new Error(`OpenAI embeddings request to ${endpoint} failed with HTTP ${response.status}`)
  }
  try {
    return await response.json()
  } catch (error) {
    throw new Error(`OpenAI embeddings response from ${endpoint} is not valid JSON`, {
      cause: error,
    })
  }
}

const OPENAI_EMBED_BATCH_SIZE = 16

/** OpenAI-compatible HTTP embedding provider. */
export class OpenAIEmbedder {
  readonly modelWarnings: readonly string[] = []
  readonly titlePrefix: boolean
  readonly headingPrefix: boolean
  private readonly config: OpenAIEmbedderConfig

  constructor(config: OpenAIEmbedderConfig) {
    this.config = config
    this.titlePrefix = config.titlePrefix ?? false
    this.headingPrefix = config.headingPrefix ?? false
  }

  async embed(text: string, role?: EmbeddingRole): Promise<number[]> {
    const vectors = await this.embedBatch([text], role)
    const vector = vectors[0]
    if (!vector) {
      throw new Error('OpenAI embedding response omitted the requested vector')
    }
    return vector
  }

  async embedBatch(texts: string[], _role?: EmbeddingRole): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }
    if (texts.some((text) => text.length === 0)) {
      throw new Error('Cannot generate embedding for empty text')
    }

    const endpoint = `${this.config.baseUrl}/embeddings`
    const vectors: number[][] = []
    for (let start = 0; start < texts.length; start += OPENAI_EMBED_BATCH_SIZE) {
      const batch = texts.slice(start, start + OPENAI_EMBED_BATCH_SIZE)
      const payload = await requestEmbeddings(this.config, endpoint, batch)
      vectors.push(...parseEmbeddingResponse(payload, batch.length, endpoint))
    }
    return vectors
  }

  async getTokenLimit(): Promise<null> {
    return null
  }

  async getDocumentPrompt(): Promise<string> {
    return ''
  }

  async getComputationIdentity(): Promise<null> {
    return null
  }

  async dispose(): Promise<void> {}
}
