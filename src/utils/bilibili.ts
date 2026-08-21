import { setParams } from 'gb-url'
import Browser from 'webextension-polyfill'
import Defuddle from 'defuddle'
import { transcriptFromText, type TranscriptItem } from '@/content-script/youtube-transcript'
import type { BilibiliSubtitleItem } from '@/utils/bilibili-transcript'

export type BilibiliContentSource = 'official-transcript' | 'compat-transcript' | 'page-context'

export interface BilibiliContentResult {
  transcript: TranscriptItem[]
  desc: string
  fallbackContent?: string
  contentSource: BilibiliContentSource
  sourceNotice?: string
}

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

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueText(values: unknown[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const text = cleanText(value)
    const key = text.toLocaleLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    result.push(text)
    if (result.length >= limit) break
  }

  return result
}

async function fetchOptionalJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const json = await response.json()
    return json?.code === 0 ? json : null
  } catch {
    return null
  }
}

async function getBilibiliTags(bvid: string): Promise<string[]> {
  if (!bvid) return []
  const url = setParams({ bvid }, 'https://api.bilibili.com/x/tag/archive/tags')
  const json = await fetchOptionalJson(url)
  return uniqueText(
    (json?.data || []).map((tag) => tag?.tag_name),
    12,
  )
}

function getCommentsFromPage(): string[] {
  const selectors = [
    '.reply-item .reply-content',
    '.root-reply .reply-content',
    '.sub-reply-item .reply-content',
    '.reply-list [class*="reply-content"]',
  ]
  const values = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)).map((element) => element.textContent),
  )
  return uniqueText(values, 24)
}

async function getBilibiliComments(aid: number): Promise<string[]> {
  const url = setParams(
    { type: '1', oid: String(aid), mode: '3', next: '0', ps: '20' },
    'https://api.bilibili.com/x/v2/reply/main',
  )
  const json = await fetchOptionalJson(url)
  const replies = Array.isArray(json?.data?.replies) ? json.data.replies : []
  const apiComments = replies
    .flatMap((reply) => [
      { text: reply?.content?.message, likes: Number(reply?.like) || 0 },
      ...(Array.isArray(reply?.replies)
        ? reply.replies.map((child) => ({
            text: child?.content?.message,
            likes: Number(child?.like) || 0,
          }))
        : []),
    ])
    .sort((a, b) => b.likes - a.likes)
    .map((comment) => comment.text)

  return uniqueText([...apiComments, ...getCommentsFromPage()], 24)
}

async function getBilibiliDanmaku(cid: number): Promise<string[]> {
  try {
    const response = await fetch(`https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`, {
      credentials: 'include',
      headers: { Accept: 'application/xml,text/xml,*/*' },
    })
    if (!response.ok) return []

    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml')
    const counts = new Map<string, { text: string; count: number; order: number }>()
    Array.from(xml.querySelectorAll('d')).forEach((element, order) => {
      const text = cleanText(element.textContent)
      if (!text) return
      const key = text.toLocaleLowerCase()
      const existing = counts.get(key)
      if (existing) existing.count += 1
      else counts.set(key, { text, count: 1, order })
    })

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.order - b.order)
      .slice(0, 80)
      .map(({ text, count }) => (count > 1 ? `${text}（×${count}）` : text))
  } catch {
    return []
  }
}

function buildPageContext({
  title,
  description,
  category,
  owner,
  tags,
  comments,
  danmaku,
}: {
  title: string
  description: string
  category: string
  owner: string
  tags: string[]
  comments: string[]
  danmaku: string[]
}): string {
  const sections = [
    `Video title: ${title}`,
    description ? `Description: ${description}` : '',
    category ? `Category: ${category}` : '',
    owner ? `Uploader: ${owner}` : '',
    tags.length > 0 ? `Tags: ${tags.join(', ')}` : '',
    danmaku.length > 0 ? `Danmaku (viewer reactions):\n- ${danmaku.join('\n- ')}` : '',
    comments.length > 0 ? `Comments (viewer discussion):\n- ${comments.join('\n- ')}` : '',
  ]

  return sections.filter(Boolean).join('\n\n')
}

function transcriptMatchesVideo(transcript: TranscriptItem[], duration: number): boolean {
  if (transcript.length === 0 || !Number.isFinite(duration) || duration <= 0) return true
  const finalTimestamp = Math.max(...transcript.map((item) => Number(item.start) || 0))
  return finalTimestamp <= duration + Math.max(30, duration * 0.15)
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

export const getBiliPageKey = (url: string) => {
  const videoId = getBiliVideoId(url)
  if (!videoId) return url

  const page = new URL(url).searchParams.get('p') || '1'
  return `${videoId.toUpperCase()}:p=${page}`
}

/**
 * Get trinscript
 */
export async function getBiliTranscript(url): Promise<BilibiliContentResult | null> {
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

  const requestedPage = Number(new URL(url).searchParams.get('p') || 1)
  const pageNumber = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const cid = data.pages?.[pageNumber - 1]?.cid || data.pages?.[0]?.cid || data.cid
  const language = navigator.language
  const transcriptRequest = { aid: data.aid, bvid: data.bvid || id, cid, language }
  let subtitleBody: BilibiliSubtitleItem[] = []
  let officialTranscriptFailed = !cid
  if (cid) {
    try {
      subtitleBody = await getBilibiliTranscriptFromPage(transcriptRequest)
      officialTranscriptFailed = false
    } catch (pageError) {
      console.debug('Unable to fetch the Bilibili transcript from the page', pageError)
      try {
        subtitleBody = await Browser.runtime.sendMessage({
          type: 'GET_BILIBILI_TRANSCRIPT',
          data: transcriptRequest,
        })
        officialTranscriptFailed = false
      } catch (backgroundError) {
        console.debug('Unable to fetch the Bilibili transcript in the background', backgroundError)
        officialTranscriptFailed = true
      }
    }
  }

  const transcript = subtitleBody
    .map((item: BilibiliSubtitleItem): TranscriptItem | undefined => {
      const start = Number(item.from)
      const text = item.content?.trim()

      if (!Number.isFinite(start) || !text) return undefined
      return { start, time: formatTimestamp(start), text }
    })
    .filter((item): item is TranscriptItem => Boolean(item))

  if (transcript.length > 0) {
    return { transcript, desc, contentSource: 'official-transcript' }
  }

  // A successful official response with no tracks is authoritative. Defuddle is
  // only a compatibility fallback for network/API failures, never for no-caption videos.
  if (officialTranscriptFailed) {
    const compatTranscript = await getBilibiliTranscriptWithDefuddle(url)
    if (transcriptMatchesVideo(compatTranscript, Number(data.duration))) {
      if (compatTranscript.length > 0) {
        return { transcript: compatTranscript, desc, contentSource: 'compat-transcript' }
      }
    } else {
      console.debug('Ignored a Bilibili transcript whose timestamps do not match this video')
    }
  }

  const [tags, comments, danmaku] = await Promise.all([
    getBilibiliTags(String(data.bvid || '')),
    getBilibiliComments(Number(data.aid)),
    cid ? getBilibiliDanmaku(Number(cid)) : Promise.resolve([]),
  ])
  const fallbackContent = buildPageContext({
    title: cleanText(data.title || document.title),
    description: cleanText(desc),
    category: cleanText(data.tname),
    owner: cleanText(data.owner?.name),
    tags,
    comments,
    danmaku,
  })
  const chinese = /^zh\b/i.test(navigator.language)

  return {
    transcript: [],
    desc,
    fallbackContent,
    contentSource: 'page-context',
    sourceNotice: chinese
      ? '本视频没有可用的官方字幕。摘要基于可获取的标题、简介、标签、弹幕和评论生成，可能无法完整反映画面内容。'
      : 'No official transcript is available. This summary uses the available title, description, tags, danmaku and comments, so it may not fully reflect the visuals.',
  }
}
