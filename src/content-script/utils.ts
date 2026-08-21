import Browser from 'webextension-polyfill'
import Defuddle from 'defuddle'
import copy from 'copy-to-clipboard'
import { BASE_URL } from '@/config'
import { config } from './search-engine-configs'
import { getYouTubeLanguageOptions, getYouTubeTranscript } from './youtube-transcript'

export function getPossibleElementByQuerySelector<T extends Element>(
  queryArray: string[],
): T | undefined {
  for (const query of queryArray) {
    const element = document.querySelector(query)
    if (element) {
      return element as T
    }
  }
  return undefined
}

export function endsWithQuestionMark(question: string) {
  return (
    question.endsWith('?') || // ASCII
    question.endsWith('？') || // Chinese/Japanese
    question.endsWith('؟') || // Arabic
    question.endsWith('⸮') // Arabic
  )
}

export function isBraveBrowser() {
  return (navigator as any).brave?.isBrave()
}

export async function shouldShowRatingTip() {
  const { ratingTipShowTimes = 0 } = await Browser.storage.local.get('ratingTipShowTimes')
  if (ratingTipShowTimes >= 5) {
    return false
  }
  await Browser.storage.local.set({ ratingTipShowTimes: ratingTipShowTimes + 1 })
  return ratingTipShowTimes >= 2
}

export function removeHtmlTags(str: string) {
  return str.replace(/<[^>]+>/g, '')
}

export async function getLangOptionsWithLink(videoId) {
  return getYouTubeLanguageOptions(videoId)
}

export function copyTranscript(subtitle) {
  let contentBody = ''
  contentBody += `${document.title}\n`
  contentBody += `${window.location.href}\n\n`

  contentBody += `Transcript:\n`

  if (!subtitle) {
    return
  }

  if (subtitle.length <= 0) {
    return
  }

  subtitle.forEach((v) => {
    contentBody += `(${v.time}) ${v.text.replaceAll('&#39;', "'")}\n`
  })

  copy(contentBody)
}

export function waitForElm(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector))
    }

    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector))
        observer.disconnect()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
  })
}

export async function getConverTranscript({ langOptionsWithLink, videoId, index }) {
  const options = Array.isArray(langOptionsWithLink) ? langOptionsWithLink : []
  const selectedTrack = options[index ?? 0]
  return getYouTubeTranscript(selectedTrack?.languageCode)
}

export function matchSites(site: string) {
  return /(^(www\.)?(google|baidu)\.)|(^(search\.)?yahoo\.)|(^(www|cn)\.?bing\.)|(^(www\.)?kagi\.)|(^(search\.)?naver\.)|(^(search\.)?brave\.)|(^(www\.)?duckduckgo\.)|(^(\w+\.)?yandex\.)|(^(www\.)?searx\.be)|(^news\.yahoo\.co\.jp)|(^(\w+\.)?ncbi\.nlm\.nih\.gov)|(^(www\.)?newspicks\.com)|(^(www\.)?nikkei\.com)|(^(www\.)?github\.com)|(^(www\.)?youtube\.com)/.test(
    site,
  )
}

export const hostname = location.hostname

export function siteName() {
  const siteRegex = new RegExp(Object.keys(config).join('|'))
  const siteName =
    hostname === 'news.yahoo.co.jp'
      ? 'yahooJpNews'
      : hostname.includes('ncbi.nlm.nih.gov')
      ? 'pubmed'
      : hostname === 'newspicks.com'
      ? 'newspicks'
      : hostname.includes('nikkei.com')
      ? 'nikkei'
      : hostname.includes('github.com')
      ? 'github'
      : hostname.includes('patents.google.com')
      ? 'googlePatents'
      : hostname.match(siteRegex)
      ? hostname.match(siteRegex)?.[0] || ''
      : ''
  return siteName
}

export function siteConfig() {
  return config[siteName()]
}

export const getPageSummaryContntent = async () => {
  try {
    const url = location.href
    const article = new Defuddle(document, { url, useAsync: false }).parse()

    return {
      title: article.title,
      content: article.content,
      description: article.description,
    }
  } catch (error) {
    console.debug('Unable to extract the page content', error)
    return undefined
  }
}

export const pageSummaryJSON: {
  title: string | null
  content: string | null
  description: string | null
  rate?: string | null
} = {
  title: null,
  content: null,
  description: null,
}

export const getReviewsSites = () => {
  const hostname = location.hostname.replace(/^www\./, '')
  const site = /amazon.\w{2,}/gi.test(hostname) ? 'amazon' : hostname

  return site
}

export const getPageSummaryComments = async () => {
  const site = getReviewsSites()

  switch (site) {
    case 'amazon': {
      const reviews = document.querySelector('.cr-widget-FocalReviews')?.textContent || ''
      const rate = document.querySelector('.AverageCustomerReviews')?.textContent || ''
      let otherCountriesReviews = ''

      document
        .querySelectorAll('#cm-cr-global-review-list div.review.aok-relative')
        .forEach((review) => {
          const reviewTitle =
            review.querySelector('span.review-title.review-title-content')?.textContent || ''
          const reviewText =
            review.querySelector('div.reviewText.review-text-content')?.textContent || ''
          otherCountriesReviews += `${reviewTitle}\n${reviewText}\n\n`
        })

      return { ...pageSummaryJSON, ...{ content: reviews + otherCountriesReviews, rate } }
    }

    case 'youtube.com': {
      let reviews = ''
      document.querySelectorAll('.ytd-comments #contents #content-text').forEach((review) => {
        reviews += review?.textContent || ''
      })

      return { ...pageSummaryJSON, ...{ content: reviews, rate: '-1' } }
    }

    default: {
      return { ...pageSummaryJSON }
    }
  }
}
