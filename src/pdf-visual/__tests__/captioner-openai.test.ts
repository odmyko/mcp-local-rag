import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenAICaptioner } from '../captioners/openai.js'
import { VlmError } from '../types.js'

function makeCaptioner() {
  return createOpenAICaptioner({
    baseUrl: 'http://vision.test/v1',
    model: 'vision-model',
    timeoutMs: 1000,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createOpenAICaptioner', () => {
  it('sends a PNG data URI and returns cleaned assistant content', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '  Keywords: diagram\nSummary: A flow diagram.  ' } }],
        })
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(makeCaptioner().caption(new Uint8Array([1, 2, 3]), 4)).resolves.toBe(
      'Keywords: diagram\nSummary: A flow diagram.'
    )
    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body))
    expect(body.model).toBe('vision-model')
    expect(body.temperature).toBe(0)
    expect(body.messages[0].content[1].image_url.url).toBe('data:image/png;base64,AQID')
  })

  it('returns null for empty assistant content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ choices: [{ message: { content: ' \n ' } }] }))
      })
    )

    await expect(makeCaptioner().caption(new Uint8Array([1]), 1)).resolves.toBeNull()
  })

  it('wraps HTTP failures as VlmError with the page number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 }))
    )

    const failure = makeCaptioner().caption(new Uint8Array([1]), 7)
    await expect(failure).rejects.toBeInstanceOf(VlmError)
    await expect(failure).rejects.toMatchObject({ pageNum: 7 })
  })

  it('reports request timeouts through VlmError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('timed out', 'TimeoutError')
      })
    )

    await expect(makeCaptioner().caption(new Uint8Array([1]), 2)).rejects.toThrow(
      'request timed out'
    )
  })
})
