import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAIEmbedder } from '../openai.js'

function makeEmbedder(): OpenAIEmbedder {
  return new OpenAIEmbedder({
    baseUrl: 'http://embedding.test/v1',
    apiKey: 'secret',
    model: 'embedding-model',
    timeoutMs: 1000,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenAIEmbedder', () => {
  it('batches, restores index order, and normalizes vectors', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: [0, 5] },
            { index: 0, embedding: [3, 4] },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeEmbedder().embedBatch(['first', 'second'])).resolves.toEqual([
      [0.6, 0.8],
      [0, 1],
    ])
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request?.headers).toEqual({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(request?.body))).toEqual({
      model: 'embedding-model',
      input: ['first', 'second'],
    })
  })

  it('splits a large batch into separate requests', async () => {
    const calls: string[][] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const parsed: unknown = JSON.parse(String(init?.body))
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('input' in parsed) ||
          !Array.isArray(parsed.input) ||
          !parsed.input.every((item) => typeof item === 'string')
        ) {
          throw new Error('expected input array')
        }
        calls.push(parsed.input)
        return new Response(
          JSON.stringify({
            data: parsed.input.map((_, index) => ({ index, embedding: [3, 4] })),
          })
        )
      })
    )

    const texts = Array.from({ length: 17 }, (_, index) => `text-${index}`)
    await expect(makeEmbedder().embedBatch(texts)).resolves.toHaveLength(17)
    expect(calls.map((input) => input.length)).toEqual([16, 1])
  })

  it('rejects malformed dimensions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            data: [
              { index: 0, embedding: [1, 2] },
              { index: 1, embedding: [1] },
            ],
          })
        )
      })
    )

    await expect(makeEmbedder().embedBatch(['first', 'second'])).rejects.toThrow(
      'inconsistent dimensions'
    )
  })

  it('reports HTTP failures without response content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('sensitive body', { status: 500 }))
    )

    await expect(makeEmbedder().embed('text')).rejects.toThrow('failed with HTTP 500')
  })

  it('reports request timeouts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timed out', 'TimeoutError')
      })
    )

    await expect(makeEmbedder().embed('text')).rejects.toThrow('request timed out')
  })

  it('disables token and computation identity discovery', async () => {
    const embedder = makeEmbedder()
    await expect(embedder.getTokenLimit()).resolves.toBeNull()
    await expect(embedder.getComputationIdentity()).resolves.toBeNull()
  })
})
