// Shared CLI global options — parsed before subcommand routing

import type { EmbeddingProviderKind } from '../embedder/provider.js'
import { MAX_CHUNK_MIN_LENGTH, MAX_FILE_SIZE_LIMIT } from '../utils/limits.js'
import { checkSensitivePath } from '../utils/sensitive-path.js'
import { isQualityProfile, type QualityProfile } from '../utils/visual-profile.js'
import type { GroupingMode } from '../vectordb/index.js'

// ============================================
// Validation Helpers
// ============================================

/**
 * Delegates to `checkSensitivePath`, so the CLI and MCP entry points share one
 * policy. Returns an error message, or `undefined` when valid.
 */
export function validatePath(value: string, flagName: string): string | undefined {
  return checkSensitivePath(value, flagName)
}

/**
 * Validate model name against allowed pattern.
 * Returns an error message if invalid, or undefined if valid.
 */
export function validateModelName(value: string): string | undefined {
  const pattern = /^[a-zA-Z0-9_\-./]+$/
  if (!pattern.test(value)) {
    return `Invalid model name: ${value}. Only alphanumeric, '_', '-', '.', '/' allowed.`
  }
  if (value.includes('..')) {
    return `Invalid model name: ${value}. Path traversal ('..') is not allowed.`
  }
  return undefined
}

/**
 * Validate max file size is within acceptable range.
 * Returns an error message if invalid, or undefined if valid.
 */
export function validateMaxFileSize(value: number): string | undefined {
  if (!Number.isFinite(value) || value < 1 || value > MAX_FILE_SIZE_LIMIT) {
    return `--max-file-size must be between 1 and ${MAX_FILE_SIZE_LIMIT} (500MB)`
  }
  return undefined
}

/**
 * Validate chunk minimum length is within acceptable range.
 * Returns an error message if invalid, or undefined if valid.
 */
export function validateChunkMinLength(value: number): string | undefined {
  if (!Number.isFinite(value) || value < 1 || value > MAX_CHUNK_MIN_LENGTH) {
    return `--chunk-min-length must be between 1 and ${MAX_CHUNK_MIN_LENGTH}`
  }
  return undefined
}

// ============================================
// Repeatable --base-dir parsing
// ============================================

/**
 * Consume the value after a `--base-dir` and append it to `collected`, so the
 * flag can repeat with its order preserved. Returns the value's index, or
 * exits 1 when the value is missing.
 *
 * Shared because `ingest`, `list` and `sync` must stay in lockstep here.
 */
export function consumeBaseDirArg(argv: string[], flagIndex: number, collected: string[]): number {
  const valueIndex = flagIndex + 1
  const value = argv[valueIndex]
  if (value === undefined || value.startsWith('-')) {
    console.error('Missing value for --base-dir')
    process.exit(1)
  }
  collected.push(value)
  return valueIndex
}

/**
 * Read the required value after a value-taking flag, exiting 1 when the next
 * token is absent or is itself a flag. The caller advances by 2. Numeric flags
 * validate the returned string themselves.
 */
export function requireFlagValue(argv: string[], flagIndex: number, flag: string): string {
  const value = argv[flagIndex + 1]
  if (value === undefined || value.startsWith('-')) {
    console.error(`Missing value for ${flag}`)
    process.exit(1)
  }
  return value
}

/**
 * Read the `--visual-quality` value, exiting 1 when it is missing or outside
 * the profile vocabulary. Shared by `ingest` and `sync` so both subcommands
 * accept and reject exactly the same values with the same message.
 */
export function requireVisualQuality(argv: string[], flagIndex: number): QualityProfile {
  const value = requireFlagValue(argv, flagIndex, '--visual-quality')
  if (!isQualityProfile(value)) {
    console.error(
      `Invalid value for --visual-quality: "${value.slice(0, 100)}". Expected "fast" or "quality".`
    )
    process.exit(1)
  }
  return value
}

// ============================================
// Types
// ============================================

export interface GlobalOptions {
  dbPath?: string | undefined
  cacheDir?: string | undefined
  modelName?: string | undefined
}

export interface ParsedGlobalResult {
  globalOptions: GlobalOptions
  remainingArgs: string[]
}

export interface ResolvedGlobalConfig {
  dbPath: string
  cacheDir: string
  modelName: string
  embeddingProvider: EmbeddingProviderKind
  openaiBaseUrl?: string
  openaiApiKey?: string
  openaiTimeoutMs: number
  visualProvider: EmbeddingProviderKind
  visualBaseUrl?: string
  visualModel?: string
  visualApiKey?: string
  visualTimeoutMs: number
  /** Search tuning, read from the same environment variables the MCP server uses. */
  maxDistance?: number
  grouping?: GroupingMode
  maxFiles?: number
  hybridWeight?: number
}

// ============================================
// Defaults
// ============================================

export const GLOBAL_DEFAULTS = {
  dbPath: './lancedb/',
  cacheDir: './models/',
  modelName: 'Xenova/all-MiniLM-L6-v2',
} as const

export const OPENAI_EMBEDDING_DEFAULTS = {
  timeoutMs: 60_000,
} as const

export const OPENAI_VISUAL_DEFAULTS = {
  timeoutMs: 120_000,
} as const

// ============================================
// Help
// ============================================

export const ROOT_HELP_TEXT = `Usage: mcp-local-rag [options] <command>

Options:
  --db-path <path>       LanceDB database path (default: ${GLOBAL_DEFAULTS.dbPath})
  --cache-dir <path>     Model cache directory (default: ${GLOBAL_DEFAULTS.cacheDir})
  --model-name <name>    Embedding model (default: ${GLOBAL_DEFAULTS.modelName})
  -h, --help             Show this help

Commands:
  ingest <path>          Ingest files into the vector database
  sync [path]            Incrementally synchronize indexed files with disk
  query <text>           Search ingested documents
  read-neighbors         Read N chunks before and after a target chunk within the same document
  list                   List files and ingestion status
  status                 Show database status
  delete <path>          Delete ingested content
  relocate               Update indexed paths after moving a project
  skills install         Install Claude Code / Codex skills`

// ============================================
// Global Option Parsing
// ============================================

/**
 * Extract global options, which are recognized only BEFORE the subcommand.
 * Everything after it is forwarded as-is.
 */
export function parseGlobalOptions(args: string[]): ParsedGlobalResult {
  const globalOptions: GlobalOptions = {}
  let help = false
  let i = 0

  // Parse global flags until we hit a non-flag (subcommand) or end of args
  while (i < args.length) {
    const arg = args[i] ?? ''
    switch (arg) {
      case '-h':
      case '--help':
        help = true
        i++
        break
      case '--db-path': {
        globalOptions.dbPath = requireFlagValue(args, i, '--db-path')
        i += 2
        break
      }
      case '--cache-dir': {
        globalOptions.cacheDir = requireFlagValue(args, i, '--cache-dir')
        i += 2
        break
      }
      case '--model-name': {
        globalOptions.modelName = requireFlagValue(args, i, '--model-name')
        i += 2
        break
      }
      default:
        // If arg starts with -, it's an unknown global flag
        if (arg.startsWith('-')) {
          console.error(`Unknown global option: ${arg}`)
          console.error('Run "mcp-local-rag --help" for available options.')
          process.exit(1)
        }
        // First non-global-flag token: treat as subcommand boundary.
        // Everything from here onward is returned as remainingArgs.
        if (help) {
          // If --help was seen before subcommand, show root help
          console.error(ROOT_HELP_TEXT)
          process.exit(0)
        }
        return { globalOptions, remainingArgs: args.slice(i) }
    }
  }

  // All args consumed (no subcommand found)
  if (help) {
    console.error(ROOT_HELP_TEXT)
    process.exit(0)
  }

  return { globalOptions, remainingArgs: [] }
}

// ============================================
// Config Resolution
// ============================================

/**
 * Resolve global config with priority: CLI flags > environment variables > defaults.
 * Validates all resolved values before returning.
 */
/** Result of parsing an environment variable. */
export interface ParseResult<T> {
  value: T | undefined
  warning?: string
}

/** Parse `RAG_GROUPING`. */
export function parseGroupingMode(value: string | undefined): ParseResult<GroupingMode> {
  if (!value) {
    return { value: undefined }
  }
  const normalized = value.toLowerCase().trim()
  if (normalized === 'similar' || normalized === 'related') {
    return { value: normalized }
  }
  const warning = `Invalid RAG_GROUPING value: "${value.slice(0, 100)}". Expected "similar" or "related". Ignoring.`
  return { value: undefined, warning }
}

/** Parse `RAG_MAX_DISTANCE`. */
export function parseMaxDistance(value: string | undefined): ParseResult<number> {
  if (!value) {
    return { value: undefined }
  }
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed) || parsed <= 0 || !Number.isFinite(parsed)) {
    const warning = `Invalid RAG_MAX_DISTANCE value: "${value.slice(0, 100)}". Expected positive number. Ignoring.`
    return { value: undefined, warning }
  }
  return { value: parsed }
}

/** Parse `RAG_MAX_FILES`. */
export function parseMaxFiles(value: string | undefined): ParseResult<number> {
  if (!value) {
    return { value: undefined }
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    const warning = `Invalid RAG_MAX_FILES value: "${value.slice(0, 100)}". Expected positive integer (>= 1). Ignoring.`
    return { value: undefined, warning }
  }
  return { value: parsed }
}

/**
 * Parse an on/off environment variable. Unset or empty is off; an
 * unrecognized value is off with a warning naming `name`.
 */
export function parseBooleanEnv(
  name: string,
  value: string | undefined
): { value: boolean; warning?: string } {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (normalized.length === 0) {
    return { value: false }
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return { value: true }
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return { value: false }
  }
  return {
    value: false,
    warning: `Invalid ${name} value: "${value?.slice(0, 100)}". Expected one of 1, true, yes, on, 0, false, no, or off. Using false.`,
  }
}

/** Parse `RAG_HYBRID_WEIGHT`. */
export function parseHybridWeight(value: string | undefined): ParseResult<number> {
  if (!value) {
    return { value: undefined }
  }
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    const warning = `Invalid RAG_HYBRID_WEIGHT value: "${value.slice(0, 100)}". Expected 0.0-1.0. Using default (0.6).`
    return { value: undefined, warning }
  }
  return { value: parsed }
}

export function resolveProvider(
  value: string | undefined,
  variableName: string
): EmbeddingProviderKind {
  const normalized = value?.trim().toLowerCase() || 'local'
  if (normalized === 'local' || normalized === 'openai') {
    return normalized
  }
  throw new Error(
    `Invalid ${variableName} value: "${value?.slice(0, 100)}". Expected "local" or "openai".`
  )
}

export function resolveHttpBaseUrl(value: string | undefined, variableName: string): string {
  const candidate = value?.trim() ?? ''
  if (!candidate) {
    throw new Error(`${variableName} is required.`)
  }
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error(`Invalid ${variableName} value: expected an absolute HTTP(S) URL.`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid ${variableName} value: expected an HTTP(S) URL.`)
  }
  return candidate.replace(/\/+$/, '')
}

export function resolveProviderBaseUrl(
  value: string | undefined,
  variableName: string,
  providerVariable: string
): string {
  if (!value?.trim()) {
    throw new Error(`${variableName} is required when ${providerVariable}=openai.`)
  }
  return resolveHttpBaseUrl(value, variableName)
}

export function resolveHttpTimeout(
  value: string | undefined,
  fallback: number,
  variableName: string
): number {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 600_000) {
    throw new Error(`Invalid ${variableName} value: expected an integer from 100 to 600000.`)
  }
  return parsed
}

function resolveEmbeddingProviderConfig(
  options: GlobalOptions
): Pick<
  ResolvedGlobalConfig,
  'embeddingProvider' | 'modelName' | 'openaiBaseUrl' | 'openaiApiKey' | 'openaiTimeoutMs'
> {
  const embeddingProvider = resolveProvider(
    process.env['RAG_EMBEDDING_PROVIDER'],
    'RAG_EMBEDDING_PROVIDER'
  )
  const configuredModelName = options.modelName ?? process.env['MODEL_NAME']
  if (embeddingProvider === 'openai' && !configuredModelName) {
    throw new Error('MODEL_NAME or --model-name is required when RAG_EMBEDDING_PROVIDER=openai.')
  }
  return {
    embeddingProvider,
    modelName: configuredModelName ?? GLOBAL_DEFAULTS.modelName,
    openaiTimeoutMs: resolveHttpTimeout(
      process.env['RAG_OPENAI_TIMEOUT_MS'],
      OPENAI_EMBEDDING_DEFAULTS.timeoutMs,
      'RAG_OPENAI_TIMEOUT_MS'
    ),
    ...(embeddingProvider === 'openai'
      ? {
          openaiBaseUrl: resolveProviderBaseUrl(
            process.env['RAG_OPENAI_BASE_URL'],
            'RAG_OPENAI_BASE_URL',
            'RAG_EMBEDDING_PROVIDER'
          ),
        }
      : {}),
    ...(process.env['RAG_OPENAI_API_KEY']
      ? { openaiApiKey: process.env['RAG_OPENAI_API_KEY'] }
      : {}),
  }
}

function resolveVisualProviderConfig(): Pick<
  ResolvedGlobalConfig,
  'visualProvider' | 'visualBaseUrl' | 'visualModel' | 'visualApiKey' | 'visualTimeoutMs'
> {
  const visualProvider = resolveProvider(process.env['RAG_VISUAL_PROVIDER'], 'RAG_VISUAL_PROVIDER')
  if (visualProvider === 'openai' && !process.env['RAG_VISUAL_MODEL']) {
    throw new Error('RAG_VISUAL_MODEL is required when RAG_VISUAL_PROVIDER=openai.')
  }
  return {
    visualProvider,
    visualTimeoutMs: resolveHttpTimeout(
      process.env['RAG_VISUAL_TIMEOUT_MS'],
      OPENAI_VISUAL_DEFAULTS.timeoutMs,
      'RAG_VISUAL_TIMEOUT_MS'
    ),
    ...(visualProvider === 'openai'
      ? {
          visualBaseUrl: resolveProviderBaseUrl(
            process.env['RAG_VISUAL_BASE_URL'],
            'RAG_VISUAL_BASE_URL',
            'RAG_VISUAL_PROVIDER'
          ),
        }
      : {}),
    ...(process.env['RAG_VISUAL_MODEL'] ? { visualModel: process.env['RAG_VISUAL_MODEL'] } : {}),
    ...(process.env['RAG_VISUAL_API_KEY']
      ? { visualApiKey: process.env['RAG_VISUAL_API_KEY'] }
      : {}),
  }
}

function validateGlobalPathsAndModel(
  dbPath: string,
  cacheDir: string,
  modelName: string,
  provider: EmbeddingProviderKind
): void {
  const dbPathError = validatePath(dbPath, '--db-path')
  if (dbPathError) {
    console.error(dbPathError)
    process.exit(1)
  }
  const cacheDirError = validatePath(cacheDir, '--cache-dir')
  if (cacheDirError) {
    console.error(cacheDirError)
    process.exit(1)
  }
  const modelNameError = provider === 'local' ? validateModelName(modelName) : undefined
  if (modelNameError) {
    console.error(modelNameError)
    process.exit(1)
  }
}

function applySearchSettings(config: ResolvedGlobalConfig): void {
  const settings = {
    maxDistance: parseMaxDistance(process.env['RAG_MAX_DISTANCE']),
    grouping: parseGroupingMode(process.env['RAG_GROUPING']),
    maxFiles: parseMaxFiles(process.env['RAG_MAX_FILES']),
    hybridWeight: parseHybridWeight(process.env['RAG_HYBRID_WEIGHT']),
  }
  for (const { warning } of Object.values(settings)) {
    if (warning !== undefined) {
      console.error(`Warning: ${warning}`)
    }
  }
  if (settings.maxDistance.value !== undefined) {
    config.maxDistance = settings.maxDistance.value
  }
  if (settings.grouping.value !== undefined) {
    config.grouping = settings.grouping.value
  }
  if (settings.maxFiles.value !== undefined) {
    config.maxFiles = settings.maxFiles.value
  }
  if (settings.hybridWeight.value !== undefined) {
    config.hybridWeight = settings.hybridWeight.value
  }
}

export function resolveGlobalConfig(options: GlobalOptions): ResolvedGlobalConfig {
  const dbPath = options.dbPath ?? process.env['DB_PATH'] ?? GLOBAL_DEFAULTS.dbPath
  const cacheDir = options.cacheDir ?? process.env['CACHE_DIR'] ?? GLOBAL_DEFAULTS.cacheDir
  const embedding = resolveEmbeddingProviderConfig(options)
  const visual = resolveVisualProviderConfig()
  validateGlobalPathsAndModel(dbPath, cacheDir, embedding.modelName, embedding.embeddingProvider)

  const config: ResolvedGlobalConfig = {
    dbPath,
    cacheDir,
    ...embedding,
    ...visual,
  }
  applySearchSettings(config)
  return config
}

/**
 * Resolve RAG_DEVICE. The value is passed through to transformers.js — no
 * allowlist is maintained here. Whitespace-only is treated as unset.
 */
export function resolveDevice(value: string | undefined): string {
  if (!value || value.trim() === '') {
    return 'cpu'
  }
  return value.trim()
}

/**
 * Resolve RAG_DTYPE, passed through with no allowlist like RAG_DEVICE. Unset
 * resolves to `undefined`, NOT a default: that is the only signal separating
 * "unset" from an explicit `RAG_DTYPE=fp32`, and it gates the failure-path
 * error enrichment. The fp32 default lives in `Embedder.initialize()` alone.
 */
export function resolveDtype(value: string | undefined): string | undefined {
  if (!value || value.trim() === '') {
    return undefined
  }
  return value.trim()
}
