import { afterEach, describe, expect, it, vi } from 'vitest'
import { rerankWithHttp } from '../http.js'
import type { RerankResult } from '../response.js'

function candidate(id: string, chunkIndex: number): RerankResult {
  return {
    filePath: `C:/docs/${id}.pdf`,
    chunkIndex,
    text: `body of ${id}`,
    score: 0.4,
    fileTitle: `Title ${id}`,
    images: [],
  }
}

const candidates = [candidate('a', 0), candidate('b', 1), candidate('c', 2)]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('rerankWithHttp', () => {
  it('reorders by the service score and trims to top', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify([
          { index: 1, score: 0.2 },
          { index: 0, score: 0.9 },
          { index: 2, score: 0.1 },
        ])
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const ranked = await rerankWithHttp({
      candidates,
      query: 'UEC ECN',
      top: 2,
      baseUrl: 'http://rerank.test',
      timeoutMs: 1000,
    })

    expect(ranked.map((item) => item.chunkIndex)).toEqual([0, 1])
    expect(ranked.map((item) => item.score)).toEqual([0, 1 / 3])
    expect(ranked[0]).toMatchObject({ rerankScore: 0.9, text: 'body of a' })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe('http://rerank.test/rerank')
    expect(JSON.parse(String(init?.body))).toEqual({
      query: 'UEC ECN',
      texts: ['body of a', 'body of b', 'body of c'],
      truncate: true,
    })
  })

  it('keeps the original order when the service rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 400 }))
    )
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      rerankWithHttp({
        candidates,
        query: 'UEC ECN',
        top: 2,
        baseUrl: 'http://rerank.test',
        timeoutMs: 1000,
      })
    ).resolves.toEqual(candidates)
    expect(stderr.mock.calls[0]?.join(' ')).toContain('HTTP 400')
  })
})
