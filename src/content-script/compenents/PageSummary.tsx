import { useState, useCallback, useEffect, useRef } from 'preact/hooks'
import classNames from 'classnames'
import {
  XIcon,
  GearIcon,
  SyncIcon,
  CopyIcon,
  CheckIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@primer/octicons-react'
import Browser from 'webextension-polyfill'
import ChatGPTQuery from '@/content-script/compenents/ChatGPTQuery'
// import { extractFromHtml } from '@/utils/article-extractor/cjs/article-extractor.esm'
import { getUserConfig, Language, getProviderConfigs, APP_TITLE } from '@/config'
import { getSummaryPrompt } from '@/content-script/prompt'
import { extractSearchPage, formatSearchResults } from '@/content-script/search-results'
import {
  getPageSummaryContntent,
  getPageSummaryComments,
  siteConfig as siteConfigFn,
} from '@/content-script/utils'
import {
  commentSummaryPrompt,
  pageSummaryPrompt,
  pageSummaryPromptHighlight,
  searchPrompt,
  searchPromptHighlight,
} from '@/utils/prompt'
import logo from '@/assets/img/logo.png'

function PageSummary() {
  const [showCard, setShowCard] = useState(false)
  const [supportSummary, setSupportSummary] = useState(true)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [latestAnswer, setLatestAnswer] = useState('')
  const [answerCopied, setAnswerCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const stopGenerationRef = useRef<(() => void) | undefined>()
  const [cardOffset, setCardOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef<{
    pointerId: number
    startX: number
    startY: number
    offsetX: number
    offsetY: number
    cardLeft: number
    cardTop: number
    cardWidth: number
    cardHeight: number
  } | null>(null)

  const onDragStart = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as HTMLElement).closest('button, a, input')) {
        return
      }

      const card = (event.currentTarget as HTMLElement).closest('.glarity--card')
      if (!card) return

      const rect = card.getBoundingClientRect()
      dragState.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: cardOffset.x,
        offsetY: cardOffset.y,
        cardLeft: rect.left - cardOffset.x,
        cardTop: rect.top - cardOffset.y,
        cardWidth: rect.width,
        cardHeight: rect.height,
      }
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
      document.body.classList.add('glarity--dragging')
      event.preventDefault()
    },
    [cardOffset],
  )

  const onDrag = useCallback((event: PointerEvent) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const edge = 8
    const nextX = drag.offsetX + event.clientX - drag.startX
    const nextY = drag.offsetY + event.clientY - drag.startY
    const minX = edge - drag.cardLeft
    const maxX = window.innerWidth - edge - drag.cardLeft - drag.cardWidth
    const minY = edge - drag.cardTop
    const maxY = window.innerHeight - edge - drag.cardTop - drag.cardHeight

    setCardOffset({
      x: Math.min(Math.max(nextX, minX), Math.max(minX, maxX)),
      y: Math.min(Math.max(nextY, minY), Math.max(minY, maxY)),
    })
  }, [])

  const onDragEnd = useCallback((event: PointerEvent) => {
    if (dragState.current?.pointerId !== event.pointerId) return
    dragState.current = null
    document.body.classList.remove('glarity--dragging')
  }, [])

  useEffect(() => {
    return () => document.body.classList.remove('glarity--dragging')
  }, [])

  const onSwitch = useCallback(() => {
    setShowCard((state) => {
      const cardState = !state

      if (cardState) {
        setQuestion('')
        setLoading(false)
        setLatestAnswer('')
        setCollapsed(false)
      }

      return cardState
    })
  }, [])

  const openOptionsPage = useCallback(() => {
    Browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })
  }, [])

  const onGenerationChange = useCallback((generating: boolean, stop?: () => void) => {
    stopGenerationRef.current = stop
    setIsGenerating(generating)
  }, [])

  const stopGeneration = useCallback(() => {
    stopGenerationRef.current?.()
  }, [])

  const onSummary = useCallback(async () => {
    setLoading(true)
    setSupportSummary(true)

    setQuestion('')
    setLatestAnswer('')

    const currentSiteConfig = siteConfigFn()
    if (currentSiteConfig?.isSearchEngine) {
      const searchPage = await extractSearchPage(currentSiteConfig)
      if (searchPage?.results.length) {
        const language = window.navigator.language
        const userConfig = await getUserConfig()
        const providerConfigs = await getProviderConfigs()
        const searchList = formatSearchResults(searchPage.results)
        const prompt = searchPrompt({
          query: searchPage.query,
          results: getSummaryPrompt(searchList, providerConfigs.provider),
          language: userConfig.language === Language.Auto ? language : userConfig.language,
          prompt: userConfig.promptSearch || searchPromptHighlight,
        })
        setQuestion(prompt)
        return
      }
    }

    const pageComments = await getPageSummaryComments()
    const pageContent = await getPageSummaryContntent()
    const article = pageComments ? pageComments : pageContent

    const title = article?.title || document.title || ''
    const description =
      article?.description ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      ''
    const content = article?.content ? description + article?.content : title + description

    if (article?.content || description) {
      const language = window.navigator.language
      const userConfig = await getUserConfig()
      const providerConfigs = await getProviderConfigs()

      const promptContent = getSummaryPrompt(
        content.replace(/(<[^>]+>|\{[^}]+\})/g, ''),
        providerConfigs.provider,
      )
      const replyLanguage = userConfig.language === Language.Auto ? language : userConfig.language

      const prompt = pageComments?.content
        ? commentSummaryPrompt({
            content: promptContent,
            language: replyLanguage,
            prompt: userConfig.promptComment
              ? userConfig.promptComment
              : pageSummaryPromptHighlight,
            rate: article?.['rate'],
          })
        : pageSummaryPrompt({
            content: promptContent,
            language: replyLanguage,
            prompt: userConfig.promptPage ? userConfig.promptPage : pageSummaryPromptHighlight,
          })

      setQuestion(prompt)
      return
    }

    setSupportSummary(false)
  }, [])

  const copyLatestAnswer = useCallback(async () => {
    if (!latestAnswer) return
    await navigator.clipboard.writeText(latestAnswer)
    setAnswerCopied(true)
  }, [latestAnswer])

  useEffect(() => {
    if (!answerCopied) return
    const timer = setTimeout(() => setAnswerCopied(false), 800)
    return () => clearTimeout(timer)
  }, [answerCopied])

  useEffect(() => {
    const handleMessage = (message) => {
      const { type } = message
      if (type === 'OPEN_WEB_SUMMARY') {
        if (showCard) {
          return
        }

        setQuestion('')
        setShowCard(true)
        setLoading(false)
      }
    }

    Browser.runtime.onMessage.addListener(handleMessage)
    return () => Browser.runtime.onMessage.removeListener(handleMessage)
  }, [showCard])

  return showCard ? (
    <div
      className="glarity--card"
      style={{ transform: `translate3d(${cardOffset.x}px, ${cardOffset.y}px, 0)` }}
    >
      <div
        className="glarity--card__head glarity--card__drag-handle"
        onPointerDown={onDragStart}
        onPointerMove={onDrag}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="glarity--card__head--title" title={APP_TITLE}>
          <img src={logo} alt="" />
          <span>{APP_TITLE}</span>
        </div>

        <div className="glarity--card__head--action">
          {isGenerating ? (
            <button
              type="button"
              className="glarity--generation-action glarity--card__stop"
              onClick={stopGeneration}
              title="Stop generating"
              aria-label="Stop generating"
            >
              <span className="glarity--stop-symbol" /> Stop
            </button>
          ) : (
            <>
              {question && (
                <button
                  type="button"
                  className="glarity--card__head-button"
                  onClick={onSummary}
                  title="Regenerate"
                  aria-label="Regenerate summary"
                  disabled={loading}
                >
                  <SyncIcon size={16} />
                </button>
              )}

              {latestAnswer && (
                <button
                  type="button"
                  className="glarity--card__head-button"
                  onClick={copyLatestAnswer}
                  title="Copy"
                  aria-label="Copy latest answer"
                >
                  {answerCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="glarity--card__head-button"
            onClick={openOptionsPage}
            title="Open settings"
            aria-label="Open settings"
          >
            <GearIcon size={16} />
          </button>

          <button
            type="button"
            className="glarity--card__head-button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand summary' : 'Collapse summary'}
          >
            {collapsed ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
          </button>

          <button
            type="button"
            className="glarity--card__head-button"
            onClick={onSwitch}
            title="Close"
            aria-label="Close summary"
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>

      <div className="glarity--card__content" hidden={collapsed}>
        {question ? (
          <div className="glarity--container">
            <div className="glarity--chatgpt">
              <ChatGPTQuery
                question={question}
                onAnswerChange={setLatestAnswer}
                onGenerationChange={onGenerationChange}
                onStatusChange={(status) => {
                  if (status) setLoading(false)
                }}
              />
            </div>
          </div>
        ) : (
          <div className="glarity--card__empty ">
            {!supportSummary ? (
              'Sorry, the summary of this page is not supported.'
            ) : (
              <button
                className={classNames(
                  'glarity--btn',
                  'glarity--btn__primary',
                  'glarity--summary-button',
                )}
                onClick={onSummary}
                disabled={loading}
              >
                Summary
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null
}

export default PageSummary
