import { getUserConfig, getProviderConfigs, Language } from '@/config'
import { getSummaryPrompt } from '@/content-script/prompt'
import {
  articlePrompt,
  googlePatentsPromptHighlight,
  videoPrompt,
  searchPrompt,
  videoSummaryPromptHightligt,
  searchPromptHighlight,
} from '@/utils/prompt'
import {
  getPossibleElementByQuerySelector,
  getLangOptionsWithLink,
  waitForElm,
  getConverTranscript,
} from '@/content-script/utils'
import { getBiliTranscript, getBiliVideoId } from '@/utils/bilibili'
import { queryParam } from 'gb-url'
import { siteConfig as sietConfigFn, siteName as siteNameFn } from '@/content-script/utils'
import { extractSearchPage, formatSearchResults } from '@/content-script/search-results'

export default async function getQuestion() {
  const siteConfig = sietConfigFn()
  const siteName = siteNameFn()

  if (!siteConfig) {
    return
  }

  const language = window.navigator.language
  const userConfig = await getUserConfig()

  const providerConfigs = await getProviderConfigs()

  // PubMed
  if (siteName === 'pubmed') {
    if (
      !/(pubmed\.ncbi\.nlm\.nih.gov\/\d{8,})|(ncbi\.nlm\.nih\.gov\/pmc\/articles\/\w+)/.test(
        location.href,
      )
    ) {
      return null
    }

    const articleTitle = document.title || ''
    const contentElement = getPossibleElementByQuerySelector(siteConfig.contentContainerQuery || [])

    document.querySelector('div#abstract-1 + #body-1')
    let articleText
    if (contentElement) {
      articleText = contentElement?.textContent
    } else {
      const eles = [
        'div#abstract-1',
        '#body-1',
        'div#sec2',
        'div#sec3',
        'div#sec4',
        'div#sec5',
        'div#sec6',
        'div#sec7',
        'div#sec8',
        'div#sec9',
        'div#sec10',
      ]

      for (let index = 0; index < eles.length; index++) {
        const text = document.querySelector(eles[index])?.textContent

        if (text) {
          articleText = articleText + ' ' + text
        }
      }
    }

    if (!articleText) {
      return null
    }
    const content = getSummaryPrompt(articleText, providerConfigs.provider)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // Yahoo Japan News
  if (siteName === 'yahooJpNews') {
    if (!/\/articles\//g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }
    const content = getSummaryPrompt(articleText, providerConfigs.provider)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // newspicks
  if (siteName === 'newspicks') {
    if (!/\/news\/\d+\/body\//g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // nikkei
  if (siteName === 'nikkei') {
    if (!/nikkei\.com\/article\/\w+/g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // github
  if (siteName === 'github') {
    if (!/github\.com\/\w+\/\w+/g.test(location.href)) {
      return null
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = getPossibleElementByQuerySelector(
      siteConfig.contentContainerQuery || [],
    )?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
    })

    return { question: queryText }
  }

  // Google Patents
  if (siteName === 'googlePatents') {
    if (!/patents.google.com\/patent\/\w+/g.test(location.href)) {
      return null
    }

    await waitForElm(siteConfig.contentContainerQuery[0])

    let contentDesc

    if (document.querySelector('div.description.patent-text')) {
      contentDesc = await waitForElm('div.description.patent-text')
    } else {
      // document.querySelector('#text #description')
      contentDesc = await waitForElm('#text #description')
    }

    const articleTitle = document.title || ''
    // const articleUrl = location.href
    const articleText = contentDesc?.textContent

    if (!articleText) {
      return null
    }

    const content = getSummaryPrompt(articleText, providerConfigs.provider)

    const queryText = articlePrompt({
      title: articleTitle,
      content: content,
      language: userConfig.language === Language.Auto ? language : userConfig.language,
      prompt: googlePatentsPromptHighlight,
    })

    return { question: queryText }
  }

  // Youtube
  if (siteName === 'youtube') {
    const videoId = queryParam('v', window.location.href)

    if (!videoId) {
      return ''
    }

    // Get Transcript Language Options & Create Language Select Btns
    const langOptionsWithLink = await getLangOptionsWithLink(videoId)

    const transcriptList = await getConverTranscript({ langOptionsWithLink, videoId, index: 0 })

    const videoTitle = document.title
    // const videoUrl = window.location.href

    const transcript = (
      transcriptList.map((v) => {
        return `${v.text}`
      }) || []
    ).join('')

    const Instructions = userConfig.prompt ? `${userConfig.prompt}` : videoSummaryPromptHightligt

    const queryText = videoPrompt({
      title: videoTitle,
      transcript: getSummaryPrompt(transcript, providerConfigs.provider),
      language: userConfig.language === Language.Auto ? language : userConfig.language,
      prompt: Instructions,
    })

    return {
      question: transcript.length > 0 ? queryText : '',
      transcript: transcriptList,
      langOptionsWithLink,
    }
  }

  // Bilibili
  if (siteName === 'bilibili') {
    const id = getBiliVideoId(window.location.href)
    if (!id) {
      return
    }

    const transcriptList = await getBiliTranscript(window.location.href)

    if (
      !transcriptList ||
      getBiliVideoId(window.location.href)?.toUpperCase() !== id.toUpperCase()
    ) {
      return
    }

    const { transcript = [], fallbackContent, contentSource, sourceNotice } = transcriptList
    const videoTitle = document.title
    const content =
      transcript.length > 0 ? transcript.map((item) => item.text).join('') : fallbackContent || ''

    let Instructions = userConfig.prompt ? `${userConfig.prompt}` : videoSummaryPromptHightligt
    if (contentSource === 'page-context') {
      Instructions = `The video has no official transcript. Summarize only the supplied metadata and viewer discussion. Clearly distinguish factual metadata from viewer reactions. Do not invent spoken dialogue, scenes, events, or claims that are not supported by the supplied text. Mention that the summary is based on page context rather than a transcript.\n\n${Instructions}`
    }

    const queryText = videoPrompt({
      title: videoTitle,
      transcript: getSummaryPrompt(content, providerConfigs.provider),
      language: userConfig.language === Language.Auto ? language : userConfig.language,
      prompt: Instructions,
    })

    return {
      question: content ? queryText : null,
      transcript,
      contentNotice: sourceNotice,
    }
  }

  if (!siteConfig.isSearchEngine) return null

  const searchPage = await extractSearchPage(siteConfig)
  if (!searchPage || searchPage.results.length === 0) return null

  const Instructions = userConfig.promptSearch
    ? `${userConfig.promptSearch}`
    : searchPromptHighlight
  const searchList = formatSearchResults(searchPage.results)
  const queryText = searchPrompt({
    query: searchPage.query,
    results: getSummaryPrompt(searchList, providerConfigs.provider),
    language: userConfig.language === Language.Auto ? language : userConfig.language,
    prompt: Instructions,
  })

  return { question: queryText }
}
