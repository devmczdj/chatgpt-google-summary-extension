import type { SearchEngine } from './search-engine-configs'

export interface SearchResultItem {
  title: string
  snippet: string
  url: string
}

export interface SearchPageData {
  query: string
  results: SearchResultItem[]
}

const GENERIC_RESULT_SELECTORS = [
  'article[data-testid="result"]',
  '[data-type="web"]',
  '#content_left .result',
  '#content_left .c-container',
  '#b_results > li.b_algo',
  'main article',
  'main .search-result',
  'main .result',
]

const GENERIC_TITLE_SELECTORS = [
  '[data-testid="result-title-a"]',
  '.search-snippet-title',
  'h2 a',
  'h3 a',
  '.result__a',
  '.result-title a',
  '.title a',
]

const GENERIC_LINK_SELECTORS = [
  '[data-testid="result-title-a"]',
  'h2 a',
  'h3 a',
  '.result__a',
  '.result-title a',
  '.title a',
  'a[href]',
]

const GENERIC_SNIPPET_SELECTORS = [
  '[data-testid="result-snippet"]',
  '[data-result="snippet"]',
  '.generic-snippet',
  '.result__snippet',
  '.snippet-content',
  '.c-abstract',
  '.b_caption p',
  '.VwiC3b',
  'p',
]

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function queryAll(selectors: string[]): Element[] {
  const seen = new Set<Element>()
  const elements: Element[] = []

  for (const selector of selectors) {
    try {
      document.querySelectorAll(selector).forEach((element) => {
        if (seen.has(element)) return
        seen.add(element)
        elements.push(element)
      })
    } catch (error) {
      console.debug(`Invalid search result selector: ${selector}`, error)
    }
  }

  return elements
}

function firstDescendant(element: Element, selectors: string[]): Element | null {
  for (const selector of selectors) {
    try {
      const match = element.querySelector(selector)
      if (match) return match
    } catch (error) {
      console.debug(`Invalid search field selector: ${selector}`, error)
    }
  }
  return null
}

function isExcludedResult(element: Element, siteConfig: SearchEngine): boolean {
  if (element.closest('.glarity--container, .glarity--summary')) return true

  const template = element.getAttribute('tpl') || ''
  if (siteConfig.searchExcludeTemplates?.includes(template)) return true

  const marker = `${element.id} ${element.className} ${element.getAttribute('data-testid') || ''}`
    .toLocaleLowerCase()
    .replace(/[^a-z0-9_-]+/g, ' ')
  return /(^|[ _-])(ad|ads|advert|sponsored|related-search)([ _-]|$)/.test(marker)
}

function getResultUrl(element: Element, siteConfig: SearchEngine): string {
  const link = firstDescendant(element, [
    ...(siteConfig.searchLinkQuery || []),
    ...GENERIC_LINK_SELECTORS,
  ]) as HTMLAnchorElement | null
  if (!link?.href || !/^https?:/i.test(link.href)) return ''
  return link.href
}

function getResultTitle(element: Element, siteConfig: SearchEngine): string {
  const title = firstDescendant(element, [
    ...(siteConfig.searchTitleQuery || []),
    ...GENERIC_TITLE_SELECTORS,
  ])
  return cleanText(title?.textContent)
}

function getFallbackSnippet(element: Element, title: string): string {
  const candidates = Array.from(
    element.querySelectorAll(
      'p, span, [class*="snippet"], [class*="abstract"], [class*="description"], [class*="content"]',
    ),
  )
    .filter((candidate) => !candidate.closest('a, button, nav, [role="menu"]'))
    .map((candidate) => cleanText(candidate.textContent))
    .filter((text) => text.length >= 30 && text.length <= 1000 && text !== title)

  return candidates.sort((a, b) => b.length - a.length)[0] || ''
}

function getResultSnippet(element: Element, siteConfig: SearchEngine, title: string): string {
  const collectSnippets = (selectors: string[]) => {
    const snippets: string[] = []
    for (const selector of selectors) {
      try {
        element.querySelectorAll(selector).forEach((candidate) => {
          if (candidate.closest('a, button, nav, [role="menu"]')) return
          const text = cleanText(candidate.textContent)
          if (text.length < 20 || text === title || snippets.includes(text)) return
          snippets.push(text)
        })
      } catch (error) {
        console.debug(`Invalid search snippet selector: ${selector}`, error)
      }
    }
    return cleanText(snippets.join(' ')).slice(0, 1200)
  }

  return (
    collectSnippets(siteConfig.searchSnippetQuery || []) ||
    collectSnippets(GENERIC_SNIPPET_SELECTORS) ||
    getFallbackSnippet(element, title)
  )
}

export function extractSearchResults(siteConfig: SearchEngine, maxResults = 6): SearchResultItem[] {
  const candidates = queryAll([
    ...(siteConfig.searchResultQuery || []),
    ...GENERIC_RESULT_SELECTORS,
  ])
  const seen = new Set<string>()
  const results: SearchResultItem[] = []

  for (const candidate of candidates) {
    if (isExcludedResult(candidate, siteConfig)) continue

    const title = getResultTitle(candidate, siteConfig)
    const url = getResultUrl(candidate, siteConfig)
    const snippet = getResultSnippet(candidate, siteConfig, title)
    const key = `${title.toLocaleLowerCase()}|${url}`

    if (title.length < 3 || snippet.length < 20 || !url || seen.has(key)) continue
    seen.add(key)
    results.push({ title, snippet, url })
    if (results.length >= maxResults) break
  }

  return results
}

function waitForSearchResults(
  siteConfig: SearchEngine,
  timeoutMs = 5000,
): Promise<SearchResultItem[]> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (results: SearchResultItem[]) => {
      if (settled) return
      settled = true
      observer.disconnect()
      window.clearInterval(interval)
      window.clearTimeout(timeout)
      resolve(results)
    }
    const check = () => {
      const results = extractSearchResults(siteConfig)
      if (results.length > 0) finish(results)
    }
    const observer = new MutationObserver(check)
    const interval = window.setInterval(check, 160)
    const timeout = window.setTimeout(() => finish(extractSearchResults(siteConfig)), timeoutMs)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    check()
  })
}

export async function extractSearchPage(siteConfig: SearchEngine): Promise<SearchPageData | null> {
  const input = siteConfig.inputQuery
    .map((selector) => document.querySelector<HTMLInputElement>(selector))
    .find(Boolean)
  const params = new URL(window.location.href).searchParams
  const query = cleanText(
    input?.value ||
      ['q', 'query', 'wd', 'text', 'p', 'keyword'].map((key) => params.get(key)).find(Boolean),
  )
  if (!query) return null

  let results = extractSearchResults(siteConfig)
  if (results.length === 0) {
    results = await waitForSearchResults(siteConfig)
  }

  return { query, results }
}

export function formatSearchResults(results: SearchResultItem[]): string {
  return results
    .map(
      ({ title, snippet, url }, index) =>
        `[${index + 1}] Title: ${title}\n[${index + 1}] Summary: ${snippet}\n[${
          index + 1
        }] URL: ${url}`,
    )
    .join('\n\n')
}
