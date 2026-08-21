import { LightBulbIcon, SearchIcon } from '@primer/octicons-react'
import { useState } from 'preact/hooks'
import { TriggerMode } from '@/config'
import ChatGPTQuery, { QueryStatus } from './ChatGPTQuery'
import { endsWithQuestionMark } from '@/content-script/utils'
import ContentNotice from './ContentNotice'

interface Props {
  question: string
  triggerMode: TriggerMode
  onStatusChange?: (status: QueryStatus) => void
  onAnswerChange?: (answer: string) => void
  onGenerationChange?: (generating: boolean, stop?: () => void) => void
  contentNotice?: string
  currentTime?: number
}

function ChatGPTCard(props: Props) {
  const {
    triggerMode,
    question,
    onStatusChange,
    onAnswerChange,
    onGenerationChange,
    contentNotice,
    currentTime: propCurrentTime,
  } = props

  const [triggered, setTriggered] = useState(false)

  if (triggerMode === TriggerMode.Always || propCurrentTime) {
    return (
      <ChatGPTQuery
        currentTime={propCurrentTime}
        question={question}
        onStatusChange={onStatusChange}
        onAnswerChange={onAnswerChange}
        onGenerationChange={onGenerationChange}
        contentNotice={contentNotice}
      />
    )
  }
  if (triggerMode === TriggerMode.QuestionMark) {
    if (endsWithQuestionMark(question.trim())) {
      return (
        <ChatGPTQuery
          question={question}
          onStatusChange={onStatusChange}
          onAnswerChange={onAnswerChange}
          onGenerationChange={onGenerationChange}
          contentNotice={contentNotice}
        />
      )
    }
    return (
      <p className="icon-and-text">
        <LightBulbIcon size="small" /> Trigger ChatGPT by appending a question mark after your query
      </p>
    )
  }
  if (triggered) {
    return (
      <>
        <ChatGPTQuery
          currentTime={propCurrentTime}
          question={question}
          onStatusChange={onStatusChange}
          onAnswerChange={onAnswerChange}
          onGenerationChange={onGenerationChange}
          contentNotice={contentNotice}
        />
      </>
    )
  }
  return (
    <>
      <ContentNotice>{contentNotice}</ContentNotice>
      <a
        href="javascript:;"
        onClick={async () => {
          setTriggered(true)
        }}
      >
        <SearchIcon size="small" /> Ask ChatGPT to summarize
      </a>
    </>
  )
}

export default ChatGPTCard
