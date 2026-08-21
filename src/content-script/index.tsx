import { render } from 'preact'
import '@/assets/styles/base.scss'
import ChatGPTTip from '@/content-script/compenents/ChatGPTTip'
import Browser from 'webextension-polyfill'
import PageSummary from '@/content-script/compenents/PageSummary'
import mount from '@/content-script/compenents/Mount'
import getQuestion from './compenents/GetQuestion'
import { siteConfig as sietConfigFn } from './utils'
import { getBiliVideoId } from '@/utils/bilibili'
import '@/content-script/styles.scss'

const siteConfig = sietConfigFn()
let runGeneration = 0

function ensurePageSummary() {
  if (document.querySelector('.glarity--summary')) return

  const container = document.createElement('section')
  container.className = 'glarity--summary'
  document.body.prepend(container)
  render(<PageSummary />, container)
}

function getPageKey() {
  const videoId = getBiliVideoId(window.location.href)
  if (!videoId) return window.location.href

  const page = new URL(window.location.href).searchParams.get('p') || '1'
  return `${videoId}:p=${page}`
}

async function Run() {
  ensurePageSummary()
  const generation = ++runGeneration
  const pageKey = getPageKey()

  const questionData = await getQuestion()
  if (generation !== runGeneration || pageKey !== getPageKey()) return

  if (questionData) {
    mount(questionData)
  }
}

Browser.runtime.onMessage.addListener(async (message) => {
  const { type, data } = message
  switch (type) {
    case 'CHATGPT_TAB_CURRENT': {
      let container = document.getElementById('glarity--chatgpt--tips')
      if (!container) {
        container = document.createElement('section')
        container.className = 'glarity--chatgpt--tips'
        container.id = 'glarity--chatgpt--tips'
        document.body.prepend(container)
      }
      render(<ChatGPTTip isLogin={data.isLogin} />, container)
      break
    }
    case 'GET_DOM': {
      return { html: document.querySelector('html')?.outerHTML }
    }
  }
})

void Run()

if (siteConfig?.watchRouteChange) {
  siteConfig.watchRouteChange(() => void Run())
}
