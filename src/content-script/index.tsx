import { render } from 'preact'
import '@/assets/styles/base.scss'
import ChatGPTTip from '@/content-script/compenents/ChatGPTTip'
import Browser from 'webextension-polyfill'
import PageSummary from '@/content-script/compenents/PageSummary'
import mount from '@/content-script/compenents/Mount'
import getQuestion from './compenents/GetQuestion'
import { siteConfig as sietConfigFn } from './utils'
import { getBiliPageKey } from '@/utils/bilibili'
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

async function Run() {
  ensurePageSummary()
  const generation = ++runGeneration
  const pageKey = getBiliPageKey(window.location.href)

  // Never leave a previous video's answer visible while the next route is loading.
  document.querySelector('section.glarity--container')?.remove()

  const questionData = await getQuestion()
  if (generation !== runGeneration || pageKey !== getBiliPageKey(window.location.href)) return

  if (questionData) {
    mount({ ...questionData, pageKey })
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
