import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import classNames from 'classnames'
import { memo } from 'react'
import { Loading } from '@geist-ui/core'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import Browser from 'webextension-polyfill'
import { Answer } from '@/messaging'
import { isBraveBrowser } from '@/content-script/utils'
import { BASE_URL } from '@/config'
import { isIOS, isSafari } from '@/utils/utils'

import '@/content-script/styles.scss'

export type QueryStatus = 'success' | 'error' | 'done' | undefined

interface Props {
  question: string
  onStatusChange?: (status: QueryStatus) => void
  onAnswerChange?: (answer: string) => void
  currentTime?: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GenerateRequest {
  question: string
  messages: ChatMessage[]
  conversationId?: string
  parentMessageId?: string
}

interface CompletedTurn {
  question?: string
  answer: Answer
}

const markdownComponents = {
  a: ({ node: _node, ...props }: any) => <a {...props} target="_blank" rel="noopener noreferrer" />,
}

function ChatGPTQuery(props: Props) {
  const { onStatusChange, onAnswerChange, currentTime, question } = props

  const [answer, setAnswer] = useState<Answer | null>(null)
  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<string>()
  const [followUp, setFollowUp] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [status, setStatus] = useState<QueryStatus>()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const portRef = useRef<Browser.Runtime.Port | null>(null)
  const historyRef = useRef<ChatMessage[]>([])
  const activeRequestRef = useRef<GenerateRequest>()

  const disconnect = useCallback(() => {
    const port = portRef.current
    portRef.current = null
    if (port) {
      try {
        port.disconnect()
      } catch (error) {
        console.debug('Port already disconnected', error)
      }
    }
  }, [])

  const startRequest = useCallback(
    (request: GenerateRequest) => {
      disconnect()
      activeRequestRef.current = request
      setAnswer(null)
      setError('')
      setDone(false)
      setStopped(false)
      setStatus(undefined)

      const port = Browser.runtime.connect()
      portRef.current = port
      port.onDisconnect.addListener(() => {
        void (Browser.runtime as any).lastError
        if (portRef.current === port) {
          portRef.current = null
        }
      })
      port.onMessage.addListener((msg: any) => {
        if (msg.text) {
          const text = String(msg.text).replace(/^(\s|:\n\n)+|(:)+|(:\s)$/g, '')
          setAnswer({ ...msg, text })
          setStatus('success')
        } else if (msg.error) {
          setError(msg.error)
          setStatus('error')
          disconnect()
        } else if (msg.event === 'DONE') {
          setDone(true)
          setStatus('done')
          disconnect()
        }
      })
      port.postMessage(request)
    },
    [disconnect],
  )

  const stopGeneration = useCallback(() => {
    disconnect()
    setDone(true)
    setStopped(true)
    setStatus('done')
  }, [disconnect])

  const submitFollowUp = useCallback(
    (event: Event) => {
      event.preventDefault()
      const nextQuestion = followUp.trim()
      if (!nextQuestion || !answer || !done) {
        return
      }

      setCompletedTurns((turns) => [...turns, { question: currentQuestion, answer }])
      const messages: ChatMessage[] = [
        ...historyRef.current,
        { role: 'assistant', content: answer.text },
        { role: 'user', content: nextQuestion },
      ]
      historyRef.current = messages
      setCurrentQuestion(nextQuestion)
      setFollowUp('')
      startRequest({
        question: nextQuestion,
        messages,
        conversationId: answer.conversationId,
        parentMessageId: answer.messageId,
      })
    },
    [answer, currentQuestion, done, followUp, startRequest],
  )

  const retryCurrentRequest = useCallback(() => {
    if (activeRequestRef.current) {
      startRequest(activeRequestRef.current)
    }
  }, [startRequest])

  const newTab = useCallback(() => {
    Browser.runtime.sendMessage({ type: 'NEW_TAB', data: { url: `${BASE_URL}/chat` } })
  }, [])

  const openOptionsPage = useCallback(() => {
    Browser.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' })
  }, [])

  useEffect(() => {
    onStatusChange?.(status)
  }, [onStatusChange, status])

  useEffect(() => {
    onAnswerChange?.(answer?.text || '')
  }, [answer, onAnswerChange])

  useEffect(() => {
    disconnect()
    setCompletedTurns([])
    setCurrentQuestion(undefined)
    setFollowUp('')
    setAnswer(null)
    historyRef.current = [{ role: 'user', content: question }]
    const initialRequest: GenerateRequest = {
      question,
      messages: historyRef.current,
    }
    activeRequestRef.current = initialRequest
    const timer = setTimeout(() => startRequest(initialRequest), 1000)
    return () => {
      clearTimeout(timer)
      disconnect()
    }
  }, [question, currentTime, disconnect, startRequest])

  useEffect(() => {
    const onFocus = () => {
      if (error === 'UNAUTHORIZED' || error === 'CLOUDFLARE') {
        setError('')
        retryCurrentRequest()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [error, retryCurrentRequest])

  useEffect(() => {
    window.addEventListener('pagehide', disconnect)
    return () => window.removeEventListener('pagehide', disconnect)
  }, [disconnect])

  useEffect(() => {
    if (answer) {
      wrapRef.current?.scrollTo({ top: 10000, behavior: 'smooth' })
    }
  }, [answer])

  const hasConversation = completedTurns.length > 0 || !!answer || !!currentQuestion

  if (hasConversation) {
    return (
      <div className="markdown-body gpt-markdown" id="gpt-answer" dir="auto">
        <div className="glarity--chatgpt--header">
          {!done ? (
            <button className="glarity--generation-action" onClick={stopGeneration}>
              <span className="glarity--stop-symbol" /> Stop
            </button>
          ) : null}
        </div>

        <div className="glarity--chatgpt--content" ref={wrapRef}>
          {completedTurns.map((turn, index) => (
            <div className="glarity--conversation-turn" key={index}>
              {turn.question && <div className="glarity--user-message">{turn.question}</div>}
              <ReactMarkdown
                components={markdownComponents}
                rehypePlugins={[[rehypeHighlight, { detect: true }]]}
              >
                {turn.answer.text}
              </ReactMarkdown>
            </div>
          ))}

          {currentQuestion && <div className="glarity--user-message">{currentQuestion}</div>}
          {answer ? (
            <ReactMarkdown
              components={markdownComponents}
              rehypePlugins={[[rehypeHighlight, { detect: true }]]}
            >
              {answer.text}
            </ReactMarkdown>
          ) : stopped ? (
            <p className="glarity--generation-stopped">Generation stopped.</p>
          ) : error ? null : (
            <Loading />
          )}
        </div>

        {error && (
          <p className="glarity--query-error">
            {error}
            <button className="glarity--retry-button" onClick={retryCurrentRequest}>
              Retry
            </button>
          </p>
        )}

        {done && answer && (
          <form className="glarity--follow-up" onSubmit={submitFollowUp}>
            <input
              value={followUp}
              onInput={(event) => setFollowUp(event.currentTarget.value)}
              placeholder="Ask a follow-up question"
              aria-label="Ask a follow-up question"
            />
            <button type="submit" disabled={!followUp.trim()} aria-label="Send follow-up question">
              ➤
            </button>
          </form>
        )}
      </div>
    )
  }

  if (error === 'UNAUTHORIZED' || error === 'CLOUDFLARE') {
    return (
      <p>
        {isSafari ? (
          <>
            Please set an API key in the{' '}
            <button
              className={classNames('glarity--btn', 'glarity--btn__primary', 'glarity--btn__small')}
              onClick={openOptionsPage}
            >
              extension options
            </button>
            .
          </>
        ) : (
          <>
            Please log in and pass the security check at{' '}
            <button
              className={classNames('glarity--btn', 'glarity--btn__primary', 'glarity--btn__small')}
              onClick={newTab}
            >
              chatgpt.com
            </button>
            .
          </>
        )}
        {!isIOS && isBraveBrowser() && (
          <span className="glarity--block glarity--mt-2">
            Check Brave Shields if login still fails.
          </span>
        )}
      </p>
    )
  }

  if (error) {
    return (
      <p>
        Failed to load response: <span className="glarity--break-all">{error}</span>{' '}
        <button className="glarity--retry-button" onClick={retryCurrentRequest}>
          Retry
        </button>
      </p>
    )
  }

  if (stopped) {
    return <p className="glarity--generation-stopped">Generation stopped.</p>
  }

  return (
    <div className="glarity--query-loading">
      <div className="glarity--chatgpt--header">
        <button className="glarity--generation-action" onClick={stopGeneration}>
          <span className="glarity--stop-symbol" /> Stop
        </button>
      </div>
      <Loading />
    </div>
  )
}

export default memo(ChatGPTQuery)
