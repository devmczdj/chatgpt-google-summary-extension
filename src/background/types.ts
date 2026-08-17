import { Answer } from '../messaging'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type Event =
  | {
      type: 'answer'
      data: Answer
    }
  | {
      type: 'done'
    }

export interface GenerateAnswerParams {
  prompt: string
  messages?: ChatMessage[]
  conversationId?: string
  parentMessageId?: string
  onEvent: (event: Event) => void
  signal?: AbortSignal
}

export interface Provider {
  generateAnswer(params: GenerateAnswerParams): Promise<{ cleanup?: () => void }>
}
