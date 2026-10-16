import { isRecord } from '../../utils/type-guards.js'
import type { Captioner } from '../types.js'
import { VlmError } from '../types.js'
import { QUALITY_PROMPT } from './prompts.js'
import { postProcess } from './shared.js'

export interface OpenAICaptionerConfig {
  baseUrl: string
  apiKey?: string
  model: string
  timeoutMs: number
}

function responseText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null
  }
  const choices = payload['choices']
  if (!Array.isArray(choices) || choices.length === 0) {
    return null
  }
  const first = choices[0]
  if (!isRecord(first)) {
    return null
  }
  const message = first['message']
  if (!isRecord(message)) {
    return null
  }
  const content = message['content']
  return typeof content === 'string' ? content : null
}

function failureMessage(error: unknown): string {
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return 'request timed out'
  }
  return error instanceof Error ? error.message : String(error)
}

export function createOpenAICaptioner(config: OpenAICaptionerConfig): Captioner {
  return {
    async caption(pngBytes: Uint8Array, pageNum: number): Promise<string | null> {
      const endpoint = `${config.baseUrl}/chat/completions`
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (config.apiKey) {
        headers['authorization'] = `Bearer ${config.apiKey}`
      }
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: QUALITY_PROMPT },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`,
                    },
                  },
                ],
              },
            ],
            temperature: 0,
            max_tokens: 256,
          }),
          signal: AbortSignal.timeout(config.timeoutMs),
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const payload: unknown = await response.json()
        const text = responseText(payload)
        if (text === null) {
          throw new Error('response has no assistant message content')
        }
        return postProcess(text)
      } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error))
        throw new VlmError(
          `OpenAI caption request to ${endpoint} failed: ${failureMessage(error)}`,
          { cause, pageNum }
        )
      }
    },
    async dispose(): Promise<void> {},
  }
}
