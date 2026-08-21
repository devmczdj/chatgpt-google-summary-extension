import {
  fetchBilibiliTranscript,
  type BilibiliTranscriptRequest,
} from '@/utils/bilibili-transcript'

interface BilibiliTranscriptRequestDetail extends BilibiliTranscriptRequest {
  requestId?: string
}

const REQUEST_EVENT = 'ai-page-summary:bilibili-transcript-request'
const RESPONSE_EVENT = 'ai-page-summary:bilibili-transcript-response'

window.addEventListener(REQUEST_EVENT, async (event: Event) => {
  const detail = (event as CustomEvent<BilibiliTranscriptRequestDetail>).detail || {}
  const requestId = detail.requestId || ''
  if (!requestId) return

  try {
    const body = await fetchBilibiliTranscript(detail)
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: { requestId, body } }))
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent(RESPONSE_EVENT, {
        detail: { requestId, error: error instanceof Error ? error.message : String(error) },
      }),
    )
  }
})
