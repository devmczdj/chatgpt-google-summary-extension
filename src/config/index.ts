import { defaults } from 'lodash-es'
import Browser from 'webextension-polyfill'

export enum TriggerMode {
  Always = 'always',
  QuestionMark = 'questionMark',
  Manually = 'manually',
}

export const TRIGGER_MODE_TEXT = {
  [TriggerMode.Always]: { title: 'Always', desc: 'ChatGPT is queried on every search' },
  [TriggerMode.Manually]: {
    title: 'Manually',
    desc: 'ChatGPT is queried when you manually click a button',
  },
}

export enum Theme {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

export enum Language {
  Auto = 'auto',
  English = 'en-US',
  ChineseSimplified = 'zh-Hans',
  ChineseTraditional = 'zh-Hant',
  Spanish = 'es-ES',
  French = 'fr-FR',
  Korean = 'ko-KR',
  Japanese = 'ja-JP',
  German = 'de-DE',
  Portuguese = 'pt-PT',
  Russian = 'ru-RU',
}

const userConfigWithDefaultValue: {
  triggerMode: TriggerMode
  theme: Theme
  language: Language
  prompt: string
  promptSearch: string
  promptPage: string
  promptComment: string
  enableSites: string[] | null
  pageSummaryEnable: boolean
  pageSummaryWhitelist: string
  pageSummaryBlacklist: string
  continueConversation: boolean
} = {
  triggerMode: TriggerMode.Always,
  theme: Theme.Auto,
  language: Language.Auto,
  prompt: '',
  promptSearch: '',
  promptPage: '',
  promptComment: '',
  enableSites: null,
  pageSummaryEnable: true,
  pageSummaryWhitelist: '',
  pageSummaryBlacklist: '',
  continueConversation: true,
}

export type UserConfig = typeof userConfigWithDefaultValue

export async function getUserConfig(): Promise<UserConfig> {
  const result = await Browser.storage.local.get(Object.keys(userConfigWithDefaultValue))
  return defaults(result, userConfigWithDefaultValue)
}

export async function updateUserConfig(updates: Partial<UserConfig>) {
  console.debug('update configs', updates)
  return Browser.storage.local.set(updates)
}

export enum ProviderType {
  ChatGPT = 'chatgpt',
  OpenAICompatible = 'openai-compatible',
}

export interface OpenAICompatibleProviderConfig {
  model: string
  apiKey: string
  apiUrl: string
}

export interface ProviderConfigs {
  provider: ProviderType
  configs: {
    [ProviderType.OpenAICompatible]: OpenAICompatibleProviderConfig | undefined
  }
}

export async function getProviderConfigs(): Promise<ProviderConfigs> {
  const compatibleKey = `provider:${ProviderType.OpenAICompatible}`
  const legacyKey = 'provider:gpt3'
  const result = await Browser.storage.local.get(['provider', compatibleKey, legacyKey])
  const rawProvider = result.provider ?? ProviderType.ChatGPT
  const provider = rawProvider === 'gpt3' ? ProviderType.OpenAICompatible : rawProvider
  const stored = result[compatibleKey] ?? result[legacyKey]

  // Migrate configurations saved by the original extension.
  const legacyApiUrl = stored?.apiHost
    ? `${/^https?:\/\//.test(stored.apiHost) ? '' : 'https://'}${stored.apiHost}${
        stored.apiPath || '/v1/chat/completions'
      }`
    : undefined
  const compatibleConfig = stored
    ? {
        model: stored.model || DEFAULT_MODEL,
        apiKey: stored.apiKey || '',
        apiUrl: stored.apiUrl || legacyApiUrl || DEFAULT_API_URL,
      }
    : undefined

  return {
    provider,
    configs: {
      [ProviderType.OpenAICompatible]: compatibleConfig,
    },
  }
}

export async function saveProviderConfigs(
  provider: ProviderType,
  configs: ProviderConfigs['configs'],
) {
  return Browser.storage.local.set({
    provider,
    [`provider:${ProviderType.OpenAICompatible}`]: configs[ProviderType.OpenAICompatible],
  })
}

export const BASE_URL = 'https://chatgpt.com'

export const DEFAULT_PAGE_SUMMARY_BLACKLIST = `https://translate.google.com
https://www.deepl.com
https://www.youtube.com
https://youku.com
https://v.qq.com
https://www.iqiyi.com
https://www.bilibili.com
https://www.tudou.com
https://www.tiktok.com
https://vimeo.com
https://www.dailymotion.com
https://www.twitch.tv
https://www.hulu.com
https://www.netflix.com
https://www.hbomax.com
https://www.disneyplus.com
https://www.peacocktv.com
https://www.crunchyroll.com
https://www.funimation.com
https://www.viki.com
https://map.baidu.com
`
export const APP_TITLE = `AI Page Summary`

export const DEFAULT_MODEL = 'gpt-4o-mini'
export const DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions'

export { normalizeChatCompletionsUrl } from './api-url'
