import type { EmbedderInterface } from '../chunker/semantic-chunker.js'
import { Embedder, type EmbeddingComputationIdentity, type EmbeddingRole } from './index.js'
import { OpenAIEmbedder } from './openai.js'

export type EmbeddingProviderKind = 'local' | 'openai'

export interface EmbeddingProvider extends EmbedderInterface {
  readonly modelWarnings: readonly string[]
  embed(text: string, role?: EmbeddingRole): Promise<number[]>
  embedBatch(texts: string[], role?: EmbeddingRole): Promise<number[][]>
  getComputationIdentity(): Promise<EmbeddingComputationIdentity | null>
  dispose(): Promise<void>
}

export interface EmbeddingProviderConfig {
  provider: EmbeddingProviderKind
  modelPath: string
  batchSize: number
  cacheDir: string
  device?: string
  dtype?: string
  titlePrefix?: boolean
  headingPrefix?: boolean
  openai?: {
    baseUrl: string
    apiKey?: string
    timeoutMs: number
  }
}

export function createEmbeddingProvider(config: EmbeddingProviderConfig): EmbeddingProvider {
  if (config.provider === 'openai') {
    if (!config.openai) {
      throw new Error('OpenAI embedding configuration is missing')
    }
    return new OpenAIEmbedder({
      ...config.openai,
      model: config.modelPath,
      ...(config.titlePrefix !== undefined ? { titlePrefix: config.titlePrefix } : {}),
      ...(config.headingPrefix !== undefined ? { headingPrefix: config.headingPrefix } : {}),
    })
  }

  const localConfig: ConstructorParameters<typeof Embedder>[0] = {
    modelPath: config.modelPath,
    batchSize: config.batchSize,
    cacheDir: config.cacheDir,
  }
  if (config.device !== undefined) {
    localConfig.device = config.device
  }
  if (config.dtype !== undefined) {
    localConfig.dtype = config.dtype
  }
  if (config.titlePrefix !== undefined) {
    localConfig.titlePrefix = config.titlePrefix
  }
  if (config.headingPrefix !== undefined) {
    localConfig.headingPrefix = config.headingPrefix
  }
  return new Embedder(localConfig)
}
