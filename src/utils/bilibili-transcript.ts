export interface BilibiliTranscriptRequest {
  aid?: number
  bvid?: string
  cid?: number
  language?: string
}

export interface BilibiliSubtitleItem {
  from: number
  to?: number
  content: string
}

interface BilibiliSubtitleTrack {
  lan: string
  lanDoc: string
  subtitleUrl: string
  id?: number
  isAi: boolean
}

const FETCH_TIMEOUT_MS = 8000
const transcriptCache = new Map<string, BilibiliSubtitleItem[]>()

function normalizeLanguageCode(code?: string): string {
  return (code || '').trim().replace(/_/g, '-').toLocaleLowerCase()
}

function stableUrlKey(value: string): string {
  try {
    const normalized = value.startsWith('//') ? `https:${value}` : value
    const url = new URL(normalized)
    return `${url.hostname.toLocaleLowerCase()}${url.pathname}`
  } catch {
    return value.split(/[?#]/)[0]
  }
}

function parseSubtitleTracks(json: any): BilibiliSubtitleTrack[] {
  const candidates = [
    json?.data?.subtitle?.subtitles,
    json?.data?.subtitle?.list,
    json?.data?.subtitle?.tracks,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue

    return candidate
      .map((track) => {
        const aiFlag =
          typeof track?.is_ai_subtitle === 'boolean'
            ? track.is_ai_subtitle
            : typeof track?.is_ai_subtitle === 'number'
            ? track.is_ai_subtitle > 0
            : typeof track?.ai_type === 'number'
            ? track.ai_type > 0
            : false

        return {
          lan: String(track?.lan ?? track?.lang ?? track?.language ?? ''),
          lanDoc: String(track?.lan_doc ?? ''),
          subtitleUrl: String(track?.subtitle_url ?? track?.subtitleUrl ?? track?.url ?? ''),
          id:
            typeof track?.id === 'number'
              ? track.id
              : typeof track?.subtitle_id === 'number'
              ? track.subtitle_id
              : undefined,
          isAi: aiFlag,
        }
      })
      .filter((track) => track.lan && track.subtitleUrl)
  }

  return []
}

function pickSubtitleTrack(
  tracks: BilibiliSubtitleTrack[],
  preferredLanguage?: string,
): BilibiliSubtitleTrack | undefined {
  const preferred = normalizeLanguageCode(preferredLanguage)
  const preferredBase = preferred.split('-')[0]

  const languagePriority = (code: string) => {
    if (code === 'zh-cn' || code === 'zh-hans') return 0
    if (code === 'zh') return 1
    if (code.startsWith('zh-')) return 2
    if (code === 'en' || code.startsWith('en-')) return 3
    return 4
  }

  const looksLikeAi = (track: BilibiliSubtitleTrack) => {
    const label = track.lanDoc.toLocaleLowerCase()
    return track.isAi || label.includes('ai') || label.includes('auto') || label.includes('自动')
  }

  return tracks
    .map((track, index) => {
      const language = normalizeLanguageCode(track.lan)
      let preferenceScore = 3
      if (preferred) {
        if (language === preferred) preferenceScore = 0
        else if (language === preferredBase) preferenceScore = 1
        else if (language.split('-')[0] === preferredBase) preferenceScore = 2
      }

      return {
        track,
        index,
        preferenceScore,
        aiScore: looksLikeAi(track) ? 1 : 0,
        languageScore: languagePriority(language),
        id: track.id ?? Number.MAX_SAFE_INTEGER,
        label: track.lanDoc.trim().toLocaleLowerCase(),
        url: stableUrlKey(track.subtitleUrl),
      }
    })
    .sort((a, b) => {
      if (a.preferenceScore !== b.preferenceScore) return a.preferenceScore - b.preferenceScore
      if (a.aiScore !== b.aiScore) return a.aiScore - b.aiScore
      if (a.languageScore !== b.languageScore) return a.languageScore - b.languageScore
      if (a.id !== b.id) return a.id - b.id
      if (a.label !== b.label) return a.label.localeCompare(b.label)
      if (a.url !== b.url) return a.url.localeCompare(b.url)
      return a.index - b.index
    })[0]?.track
}

function normalizeSubtitleUrl(value: string): URL | null {
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    if (url.protocol !== 'https:') return null

    const host = url.hostname.toLocaleLowerCase()
    const allowed =
      host === 'hdslb.com' ||
      host.endsWith('.hdslb.com') ||
      host === 'bilibili.com' ||
      host.endsWith('.bilibili.com')
    return allowed ? url : null
  } catch {
    return null
  }
}

async function fetchJson(url: URL | string): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Bilibili request failed (${response.status})`)

    const json = await response.json()
    if (typeof json?.code === 'number' && json.code !== 0) {
      throw new Error(`Bilibili API error (${json.code}: ${json.message || 'unknown'})`)
    }
    return json
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeSubtitleBody(json: any): BilibiliSubtitleItem[] {
  const body = Array.isArray(json?.body) ? json.body : []
  const seen = new Set<string>()

  return body
    .map((item) => ({
      from: Number(item?.from),
      to: Number.isFinite(Number(item?.to)) ? Number(item.to) : undefined,
      content: String(item?.content ?? '').trim(),
    }))
    .filter((item) => Number.isFinite(item.from) && item.from >= 0 && item.content)
    .sort((a, b) => a.from - b.from)
    .filter((item) => {
      const key = `${item.from}:${item.content}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export async function fetchBilibiliTranscript(
  request: BilibiliTranscriptRequest,
): Promise<BilibiliSubtitleItem[]> {
  const aid = Number(request.aid)
  const cid = Number(request.cid)
  const bvid = String(request.bvid || '')
  const validAid = Number.isFinite(aid) && aid > 0
  const validBvid = /^BV[0-9A-Za-z]+$/i.test(bvid)

  if (!Number.isFinite(cid) || cid <= 0 || (!validAid && !validBvid)) {
    throw new Error('Invalid Bilibili video identifiers')
  }

  const language = normalizeLanguageCode(request.language)
  const cacheKey = `${validBvid ? bvid.toUpperCase() : aid}:${cid}:${language}`
  const cached = transcriptCache.get(cacheKey)
  if (cached) return cached

  const endpointUrls: URL[] = []
  if (validBvid && validAid) {
    const wbiUrl = new URL('https://api.bilibili.com/x/player/wbi/v2')
    wbiUrl.searchParams.set('bvid', bvid)
    wbiUrl.searchParams.set('aid', String(aid))
    wbiUrl.searchParams.set('cid', String(cid))
    endpointUrls.push(wbiUrl)
  }
  if (validBvid) {
    const bvidUrl = new URL('https://api.bilibili.com/x/player/v2')
    bvidUrl.searchParams.set('bvid', bvid)
    bvidUrl.searchParams.set('cid', String(cid))
    endpointUrls.push(bvidUrl)
  }
  if (validAid) {
    const aidUrl = new URL('https://api.bilibili.com/x/player/v2')
    aidUrl.searchParams.set('aid', String(aid))
    aidUrl.searchParams.set('cid', String(cid))
    endpointUrls.push(aidUrl)
  }

  let tracks: BilibiliSubtitleTrack[] = []
  let lastError: unknown
  let receivedSuccessfulResponse = false
  for (const endpoint of endpointUrls) {
    try {
      tracks = parseSubtitleTracks(await fetchJson(endpoint))
      receivedSuccessfulResponse = true
      if (tracks.length > 0) break
    } catch (error) {
      lastError = error
    }
  }

  if (tracks.length === 0) {
    if (!receivedSuccessfulResponse && lastError) throw lastError
    transcriptCache.set(cacheKey, [])
    return []
  }

  const selectedTrack = pickSubtitleTrack(tracks, language)
  const subtitleUrl = selectedTrack ? normalizeSubtitleUrl(selectedTrack.subtitleUrl) : null
  if (!subtitleUrl) throw new Error('Bilibili subtitle URL is missing or invalid')

  const body = normalizeSubtitleBody(await fetchJson(subtitleUrl))
  transcriptCache.set(cacheKey, body)
  return body
}
