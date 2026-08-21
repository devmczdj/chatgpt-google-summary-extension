import Defuddle from 'defuddle'

export interface CaptionTrackOption {
  language: string
  languageCode: string
}

export interface TranscriptItem {
  time: string
  text: string
  start: number
}

interface CaptionTrack {
  languageCode?: string
  name?: {
    simpleText?: string
    runs?: Array<{ text?: string }>
  }
}

interface YouTubePlayerResponse {
  videoDetails?: { videoId?: string }
  microformat?: { playerMicroformatRenderer?: { externalVideoId?: string } }
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] }
  }
}

function parseInlineJson(globalName: string): YouTubePlayerResponse | undefined {
  for (const script of Array.from(document.scripts)) {
    const source = script.textContent || ''
    const nameIndex = source.indexOf(globalName)
    if (nameIndex < 0) continue

    const startIndex = source.indexOf('{', nameIndex)
    if (startIndex < 0) continue

    let depth = 0
    let quote = ''
    let escaped = false

    for (let index = startIndex; index < source.length; index += 1) {
      const char = source[index]

      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = ''
        continue
      }

      if (char === '"' || char === "'") quote = char
      else if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(startIndex, index + 1))
          } catch {
            break
          }
        }
      }
    }
  }

  return undefined
}

function getValidatedPlayerResponse(videoId: string): YouTubePlayerResponse | undefined {
  const response = parseInlineJson('ytInitialPlayerResponse')
  const responseVideoId =
    response?.videoDetails?.videoId ||
    response?.microformat?.playerMicroformatRenderer?.externalVideoId

  return responseVideoId === videoId ? response : undefined
}

function trackLabel(track: CaptionTrack): string {
  return (
    track.name?.simpleText ||
    track.name?.runs
      ?.map((run) => run.text || '')
      .join('')
      .trim() ||
    track.languageCode ||
    'Unknown'
  )
}

export async function getYouTubeLanguageOptions(videoId: string): Promise<CaptionTrackOption[]> {
  const response = getValidatedPlayerResponse(videoId)
  const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks)) return []

  return tracks
    .filter((track) => Boolean(track.languageCode))
    .map((track) => ({
      language: trackLabel(track),
      languageCode: track.languageCode || '',
    }))
    .sort((left, right) => {
      const leftEnglish = left.languageCode.toLowerCase().startsWith('en') ? 0 : 1
      const rightEnglish = right.languageCode.toLowerCase().startsWith('en') ? 0 : 1
      return leftEnglish - rightEnglish
    })
}

function timestampToSeconds(timestamp: string): number {
  return timestamp
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0)
}

function transcriptFromHtml(content: string): TranscriptItem[] {
  const parsed = new DOMParser().parseFromString(content, 'text/html')

  return Array.from(parsed.querySelectorAll('.youtube.transcript .transcript-segment'))
    .map((segment) => {
      const timestamp = segment.querySelector<HTMLElement>('.timestamp')
      const time = timestamp?.textContent?.trim() || ''
      const start = Number(timestamp?.dataset.timestamp ?? timestampToSeconds(time))
      const textContainer = segment.cloneNode(true) as HTMLElement
      textContainer.querySelector('.timestamp')?.closest('strong')?.remove()
      const text = (textContainer.textContent || '').replace(/^\s*·\s*/, '').trim()

      if (!time || !text || !Number.isFinite(start)) return undefined
      return { time, text, start }
    })
    .filter((item): item is TranscriptItem => Boolean(item))
}

export function transcriptFromText(transcript: string): TranscriptItem[] {
  return transcript
    .split('\n')
    .map((line) => line.match(/^\*\*([^*]+)\*\*\s*·\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      time: match[1],
      text: match[2],
      start: timestampToSeconds(match[1]),
    }))
}

export async function getYouTubeTranscript(languageCode?: string): Promise<TranscriptItem[]> {
  try {
    const defuddle = new Defuddle(document, {
      url: window.location.href,
      language: languageCode,
      useAsync: true,
    })
    const result = await defuddle.parseAsync()
    const items = transcriptFromHtml(result.content)

    if (items.length > 0) return items
    return transcriptFromText(result.variables?.transcript || '')
  } catch (error) {
    console.debug('Unable to extract the YouTube transcript', error)
    return []
  }
}
