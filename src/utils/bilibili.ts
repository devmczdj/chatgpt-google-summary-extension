import { setParams } from 'gb-url'
import Browser from 'webextension-polyfill'
import Defuddle from 'defuddle'
import { transcriptFromText, type TranscriptItem } from '@/content-script/youtube-transcript'
import type { BilibiliSubtitleItem } from '@/utils/bilibili-transcript'

const BRIDGE_ID = 'ai-page-summary-bilibili-bridge'
const REQUEST_EVENT = 'ai-page-summary:bilibili-transcript-request'
const RESPONSE_EVENT = 'ai-page-summary:bilibili-transcript-response'

function loadBilibiliBridge(): Promise<void> {
  const existing = document.getElementById(BRIDGE_ID) as HTMLScriptElement | null
  if (existing?.dataset.loaded === 'true') return Promise.resolve()

  return new Promise((resolve, reject) => {
    const script = existing || document.createElement('script')

    const onLoad = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    const onError = () => reject(new Error('Unable to load the Bilibili page bridge'))
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })

    if (!existing) {
      script.id = BRIDGE_ID
      script.src = Browser.runtime.getURL('bilibili-page-bridge.js')
      ;(document.head || document.documentElement).appendChild(script)
    }
  })
}

async function getBilibiliTranscriptFromPage(data): Promise<BilibiliSubtitleItem[]> {
  await loadBilibiliBridge()
  const requestId = crypto.randomUUID()

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener(RESPONSE_EVENT, handleResponse)
      reject(new Error('Bilibili transcript request timed out'))
    }, 10000)

    const handleResponse = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      if (detail.requestId !== requestId) return

      window.clearTimeout(timeout)
      window.removeEventListener(RESPONSE_EVENT, handleResponse)
      if (detail.error) reject(new Error(detail.error))
      else resolve(Array.isArray(detail.body) ? detail.body : [])
    }

    window.addEventListener(RESPONSE_EVENT, handleResponse)
    window.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: { requestId, ...data } }))
  })
}

function formatTimestamp(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const remainingSeconds = value % 60
  const minuteText = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const secondText = String(remainingSeconds).padStart(2, '0')

  return hours > 0 ? `${hours}:${minuteText}:${secondText}` : `${minuteText}:${secondText}`
}

async function getBilibiliTranscriptWithDefuddle(url: string): Promise<TranscriptItem[]> {
  try {
    const result = await new Defuddle(document, {
      url,
      language: navigator.language,
      useAsync: true,
    }).parseAsync()

    return transcriptFromText(result.variables?.transcript || '')
  } catch (error) {
    console.debug('Unable to extract the Bilibili transcript with Defuddle', error)
    return []
  }
}

export const getBiliVideoId = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    if (!/(^|\.)bilibili\.com$/i.test(parsedUrl.hostname)) return null

    const id = parsedUrl.pathname.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)(?:\/|$)/i)?.[1]
    return id || null
  } catch {
    return null
  }
}

/**
 * Get trinscript
 */
export async function getBiliTranscript(url) {
  const id = getBiliVideoId(url)

  if (!id) {
    return null
  }

  let params = {
    aid: '',
    bvid: '',
  }
  params = /^av/i.test(id)
    ? Object.assign(params, { aid: id.replace(/^av/, '') })
    : Object.assign(params, {
        bvid: id,
      })

  const videoUrl = setParams(params, 'https://api.bilibili.com/x/web-interface/view')
  const detail = await fetch(videoUrl, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!detail.ok) throw new Error(`Unable to load Bilibili video metadata (${detail.status})`)
  const detailJson = await detail.json()
  if (detailJson?.code !== 0) {
    throw new Error(`Bilibili video metadata error (${detailJson?.code ?? 'unknown'})`)
  }
  const { data = {} } = detailJson
  const descV2 = data.desc_v2 || []
  const desc = descV2.length > 0 ? descV2.map((v) => v.raw_text).join(',') : data.desc

  // Obsidian Web Clipper uses Defuddle for Bilibili. Keep it as the primary
  // extractor so cookie handling, track selection and transcript grouping stay
  // aligned with the mature implementation we already ship as a dependency.
  const defuddleTranscript = await getBilibiliTranscriptWithDefuddle(url)
  if (defuddleTranscript.length > 0) {
    return { transcript: defuddleTranscript, desc }
  }

  const requestedPage = Number(new URL(url).searchParams.get('p') || 1)
  const pageNumber = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const cid = data.pages?.[pageNumber - 1]?.cid || data.pages?.[0]?.cid || data.cid
  const language = navigator.language
  const transcriptRequest = { aid: data.aid, bvid: data.bvid || id, cid, language }
  const subtitleBody: BilibiliSubtitleItem[] = cid
    ? await getBilibiliTranscriptFromPage(transcriptRequest).catch((error) => {
        console.debug('Unable to fetch the Bilibili transcript from the page', error)
        return Browser.runtime
          .sendMessage({
            type: 'GET_BILIBILI_TRANSCRIPT',
            data: transcriptRequest,
          })
          .catch(() => [])
      })
    : []

  if (subtitleBody.length === 0) {
    return desc
      ? {
          transcript: null,
          desc,
        }
      : null
  }

  const transcript = subtitleBody
    .map((item: BilibiliSubtitleItem): TranscriptItem | undefined => {
      const start = Number(item.from)
      const text = item.content?.trim()

      if (!Number.isFinite(start) || !text) return undefined
      return { start, time: formatTimestamp(start), text }
    })
    .filter((item): item is TranscriptItem => Boolean(item))

  return {
    transcript,
    desc,
  }
}
