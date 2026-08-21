import { fetchSSE } from '../fetch-sse'
import { GenerateAnswerParams, Provider } from '../types'
import { normalizeChatCompletionsUrl, OpenAICompatibleProviderConfig } from '@/config'
import { hasApiHostPermission } from '@/utils/api-host-permission'

export class OpenAIProvider implements Provider {
  constructor(private config: OpenAICompatibleProviderConfig) {}

  async generateAnswer(params: GenerateAnswerParams) {
    const url = normalizeChatCompletionsUrl(this.config.apiUrl)
    const granted = await hasApiHostPermission(url)
    if (!granted) {
      throw new Error('Host permission is required to call this API endpoint. Open the options page and save the API URL again.')
    }
    const reqParams = {
      model: this.config.model,
      messages: params.messages || [{ role: 'user', content: params.prompt }],
      stream: true,
    }

    let result = ''
    let completed = false
    let streamError: Error | undefined
    await fetchSSE(url, {
      method: 'POST',
      signal: params.signal,
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(reqParams),
      onMessage(message) {
        console.debug('sse message', message)
        if (message === '[DONE]') {
          completed = true
          params.onEvent({ type: 'done' })
          return
        }
        let data
        try {
          data = JSON.parse(message)
        } catch (err) {
          console.error('Unable to parse API stream message', err)
          return
        }
        if (data.error) {
          streamError = new Error(data.error.message || JSON.stringify(data.error))
          return
        }
        try {
          const text = data.choices?.[0]?.delta?.content

          if (!text) {
            return
          }
          result += text
          params.onEvent({
            type: 'answer',
            data: {
              text: result,
              messageId: data.id,
              conversationId: data.id,
            },
          })
        } catch (err) {
          console.error('Unable to process API stream message', err)
          return
        }
      },
    })
    if (streamError) {
      throw streamError
    }
    if (!completed) {
      params.onEvent({ type: 'done' })
    }
    return {}
  }
}
