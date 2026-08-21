import Browser from 'webextension-polyfill'
import { getProviderConfigs, ProviderType, BASE_URL } from '@/config'
import { ChatGPTProvider, getChatGPTAccessToken } from './providers/chatgpt'
import { OpenAIProvider } from './providers/openai'
import { Provider } from './types'
import { isFirefox, tabSendMsg } from '@/utils/utils'
import {
  fetchBilibiliTranscript,
  type BilibiliTranscriptRequest,
} from '@/utils/bilibili-transcript'

interface GenerateRequest {
  question: string
  messages?: { role: 'user' | 'assistant'; content: string }[]
  conversationId?: string
  parentMessageId?: string
}

function safePostMessage(port: Browser.Runtime.Port, message: unknown) {
  try {
    port.postMessage(message)
  } catch (error) {
    console.debug('Port disconnected before the response was delivered', error)
  }
}

async function generateAnswers(port: Browser.Runtime.Port, request: GenerateRequest) {
  const providerConfigs = await getProviderConfigs()

  let provider: Provider
  if (providerConfigs.provider === ProviderType.ChatGPT) {
    const token = await getChatGPTAccessToken()
    provider = new ChatGPTProvider(token)
  } else if (providerConfigs.provider === ProviderType.OpenAICompatible) {
    const config = providerConfigs.configs[ProviderType.OpenAICompatible]
    if (!config) {
      throw new Error('Please configure the OpenAI-compatible API in the extension options.')
    }
    provider = new OpenAIProvider(config)
  } else {
    throw new Error(`Unknown provider ${providerConfigs.provider}`)
  }

  const controller = new AbortController()
  let disconnected = false
  let cleanup: (() => void) | undefined
  port.onDisconnect.addListener(() => {
    // Reading lastError prevents expected lifecycle disconnects (for example
    // when a page enters the back/forward cache) from becoming unchecked errors.
    void (Browser.runtime as any).lastError
    disconnected = true
    controller.abort()
    cleanup?.()
  })

  const result = await provider.generateAnswer({
    prompt: request.question,
    messages: request.messages,
    conversationId: request.conversationId,
    parentMessageId: request.parentMessageId,
    signal: controller.signal,
    onEvent(event) {
      if (disconnected) {
        return
      }
      if (event.type === 'done') {
        safePostMessage(port, { event: 'DONE' })
        return
      }
      safePostMessage(port, event.data)
    },
  })
  cleanup = result.cleanup
  if (disconnected) {
    cleanup?.()
  }
}

async function createTab(url) {
  Browser.tabs.query({ currentWindow: true, active: true }).then((tabs) => {
    console.log('getCurrent', tabs)
    const tab = tabs[0]

    if (tab.id) {
      Browser.storage.local.set({ glarityTabId: tab.id })
    }
  })

  const oldTabId = await Browser.storage.local.get('pinnedTabId')
  let tab
  if (oldTabId.pinnedTabId) {
    try {
      tab = await Browser.tabs.get(oldTabId.pinnedTabId)
      await Browser.tabs.update(tab.id, { active: true, pinned: true })
    } catch (error) {
      console.debug('The previously pinned tab is no longer available', error)
    }
  }
  if (!tab) {
    tab = await Browser.tabs.create({
      url,
      pinned: true,
      active: true,
    })
  }
  Browser.storage.local.set({ pinnedTabId: tab.id })
  return { pinnedTabId: tab.id }
}

Browser.runtime.onConnect.addListener(async (port) => {
  port.onMessage.addListener(async (msg) => {
    console.debug('received msg', msg)
    try {
      await generateAnswers(port, msg)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        safePostMessage(port, { error: err.message })
      }
    }
  })
})

Browser.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'OPEN_OPTIONS_PAGE') {
    Browser.runtime.openOptionsPage()
  } else if (message.type === 'GET_ACCESS_TOKEN') {
    return getChatGPTAccessToken()
  } else if (message.type === 'NEW_TAB') {
    return createTab(message.data.url)
  } else if (message.type === 'GET_BILIBILI_TRANSCRIPT') {
    return fetchBilibiliTranscript((message.data || {}) as BilibiliTranscriptRequest)
  } else if (message.type === 'GO_BACK') {
    const tab = await Browser.storage.local.get('glarityTabId')

    if (tab.glarityTabId) {
      Browser.tabs.update(tab.glarityTabId, { active: true }).catch(() => {
        Browser.tabs.create({ url: 'about:newtab', active: true })
      })
    } else {
      Browser.tabs.create({ url: 'about:newtab', active: true })
    }
  }
})

Browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    Browser.runtime.openOptionsPage()
  }
})

Browser.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  const oldTabId = await Browser.storage.local.get('pinnedTabId')

  if (
    tab.url?.includes(BASE_URL) &&
    changeInfo.status === 'complete' &&
    tab.id &&
    oldTabId.pinnedTabId === tab.id
  ) {
    tabSendMsg(tab)
  }
})

Browser.tabs.onRemoved.addListener(async (tabId) => {
  const storedTabs = await Browser.storage.local.get(['pinnedTabId', 'glarityTabId'])
  const staleKeys = ['pinnedTabId', 'glarityTabId'].filter((key) => storedTabs[key] === tabId)

  if (staleKeys.length > 0) {
    await Browser.storage.local.remove(staleKeys)
  }
})

async function openPageSummary(tab) {
  const { id } = tab

  if (!id) {
    return
  }

  Browser.tabs.sendMessage(id, { type: 'OPEN_WEB_SUMMARY', data: {} }).catch(() => {})
}

Browser.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-page-summary') {
    return
  }

  const [tab] = await Browser.tabs.query({ active: true, currentWindow: true })
  if (tab) {
    await openPageSummary(tab)
  }
})

if (isFirefox) {
  Browser.browserAction.onClicked.addListener(async (tab) => {
    await openPageSummary(tab)
  })
} else {
  Browser.action.onClicked.addListener(async (tab) => {
    await openPageSummary(tab)
  })
}
