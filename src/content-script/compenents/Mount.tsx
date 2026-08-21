import { render } from 'preact'
import { getUserConfig, Theme } from '@/config'
import { config } from '@/content-script/search-engine-configs'
import ChatGPTContainer from '@/content-script/compenents/ChatGPTContainer'
import { detectSystemColorScheme } from '@/utils/utils'
import { getPossibleElementByQuerySelector, waitForElm } from '@/content-script/utils'
import {
  siteConfig as sietConfigFn,
  siteName as siteNameFn,
  hostname,
} from '@/content-script/utils'
import type { CaptionTrackOption, TranscriptItem } from '@/content-script/youtube-transcript'
import { getBiliPageKey } from '@/utils/bilibili'

interface MountProps {
  question: string | null
  transcript?: TranscriptItem[]
  langOptionsWithLink?: CaptionTrackOption[]
  contentNotice?: string
  pageKey?: string
}

function waitForPossibleElement(selectors: string[], timeoutMs = 2400): Promise<Element | undefined> {
  const existing = getPossibleElementByQuerySelector(selectors)
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    let settled = false
    const finish = (element?: Element) => {
      if (settled) return
      settled = true
      observer.disconnect()
      window.clearTimeout(timeout)
      resolve(element)
    }
    const observer = new MutationObserver(() => {
      const element = getPossibleElementByQuerySelector(selectors)
      if (element) finish(element)
    })
    const timeout = window.setTimeout(() => finish(), timeoutMs)

    observer.observe(document.body, { childList: true, subtree: true })
  })
}

async function getSearchSidebar(siteName: string, selectors: string[]): Promise<Element | undefined> {
  // Brave replaces its Svelte sidebar shortly after the results first appear.
  // Waiting for that final render prevents it from deleting injected content.
  if (siteName === 'brave') {
    await new Promise((resolve) => window.setTimeout(resolve, 1700))
  }

  const existing = getPossibleElementByQuerySelector(selectors)
  if (existing) {
    if (siteName === 'google') {
      existing.classList.add('TQc1id', 'hSOk2e', 'rhstc4', 'glarity--managed-search-sidebar')
    } else if (siteName === 'brave') {
      existing.classList.add('glarity--managed-search-sidebar')
      existing.closest('.serp-columns')?.classList.add('glarity--has-created-sidebar')
    }
    return existing
  }

  // Google omits #rhs completely when the result page has no knowledge panel.
  // Recreate the same standard rail Google uses instead of inserting into the
  // result column. This mirrors the approach used by mature sidebar injectors.
  if (siteName === 'google') {
    const resultContainer =
      document.querySelector('#rcnt') || (await waitForPossibleElement(['#rcnt'], 1800))
    if (!resultContainer) return undefined

    const sidebar = document.createElement('div')
    sidebar.id = 'rhs'
    sidebar.className = 'TQc1id hSOk2e rhstc4 glarity--managed-search-sidebar'
    sidebar.dataset.glarityCreatedSidebar = 'true'
    resultContainer.appendChild(sidebar)
    return sidebar
  }

  // Bing can omit #b_context on result pages without an answer card. Restore
  // a dedicated right rail rather than falling back to the bottom of #b_content.
  if (siteName === 'bing') {
    const resultContainer =
      document.querySelector('#b_content') ||
      (await waitForPossibleElement(['#b_content'], 1800))
    if (!resultContainer) return undefined

    resultContainer.classList.add('glarity--has-created-bing-sidebar')
    const sidebar = document.createElement('ol')
    sidebar.id = 'b_context'
    sidebar.className = 'glarity--created-bing-sidebar'
    sidebar.dataset.glarityCreatedSidebar = 'true'
    resultContainer.appendChild(sidebar)
    return sidebar
  }

  // Brave also omits its aside for searches without an answer card. Add a
  // second column to the existing results grid instead of placing the summary
  // above the result list.
  if (siteName === 'brave') {
    const resultsGrid =
      document.querySelector('.serp-layout > .serp-columns') ||
      (await waitForPossibleElement(['.serp-layout > .serp-columns'], 2400))
    if (!resultsGrid) return undefined

    resultsGrid.classList.add('glarity--has-created-sidebar')
    const sidebar = document.createElement('aside')
    sidebar.className = 'sidebar glarity--created-search-sidebar'
    sidebar.dataset.glarityCreatedSidebar = 'true'
    resultsGrid.appendChild(sidebar)
    return sidebar
  }

  return waitForPossibleElement(selectors)
}

export default async function mount(props: MountProps) {
  const siteConfig = sietConfigFn()
  const siteName = siteNameFn()

  const { question, transcript, langOptionsWithLink, contentNotice, pageKey } = props
  if (!siteConfig) {
    return
  }
  const userConfig = await getUserConfig()
  if (pageKey && getBiliPageKey(window.location.href) !== pageKey) return

  const sites = Object.values(config).map((site) => {
    return site.siteValue
  })

  const enableSites = userConfig.enableSites ? userConfig.enableSites : sites
  const regexList: string[] = []
  Object.values(enableSites).map((v) => {
    const item = config[v]

    if (item.regex) {
      regexList.push(item.regex)
    }
  })

  if (regexList.length <= 0) {
    return
  }
  const sitesRegex = new RegExp(regexList.join('|'))

  if (!sitesRegex.test(hostname)) {
    return
  }

  if (document.querySelector('section.glarity--container')) {
    document.querySelector('section.glarity--container')?.remove()
  }

  const container = document.createElement('section')
  container.className = 'b_glarity'
  container.classList.add('glarity--container')
  container.id = 'glarity--container'

  let theme: Theme
  if (userConfig.theme === Theme.Auto) {
    theme = detectSystemColorScheme()
  } else {
    theme = userConfig.theme
  }
  if (theme === Theme.Dark) {
    container.classList.add('gpt--dark')
  } else {
    container.classList.add('gpt--light')
  }

  switch (siteName) {
    case 'pubmed': {
      container.classList.add('glarity--chatgpt--pubmed')
      const appendContainer = getPossibleElementByQuerySelector(
        siteConfig.extabarContainerQuery || [],
      )
      appendContainer?.prepend(container)
      break
    }
    case 'newspicks': {
      container.classList.add('glarity--chatgpt--newspicks')
      const appendContainer = getPossibleElementByQuerySelector(
        siteConfig.extabarContainerQuery || [],
      )
      appendContainer?.prepend(container)
      break
    }

    case 'yahooJpNews': {
      container.classList.add('glarity--chatgpt--yahoonews')

      const appendContainer = getPossibleElementByQuerySelector(
        siteConfig.extabarContainerQuery || [],
      )
      appendContainer?.prepend(container)
      break
    }
    case 'nikkei': {
      container.classList.add('glarity--chatgpt--nikkei')
      const appendContainer = getPossibleElementByQuerySelector(
        siteConfig.extabarContainerQuery || [],
      )
      appendContainer?.prepend(container)
      break
    }
    case 'github': {
      container.classList.add('glarity--chatgpt--github')
      const appendContainer = getPossibleElementByQuerySelector(
        siteConfig.extabarContainerQuery || [],
      )
      appendContainer?.prepend(container)
      break
    }

    case 'googlePatents': {
      const extabarContainerQuery =
        siteConfig.extabarContainerQuery && siteConfig.extabarContainerQuery[0]

      if (!extabarContainerQuery) {
        return
      }

      waitForElm(extabarContainerQuery).then(() => {
        container.classList.add('glarity--chatgpt--googlePatents')
        const appendContainer = getPossibleElementByQuerySelector(
          siteConfig.extabarContainerQuery || [],
        )
        appendContainer?.prepend(container)
      })

      break
    }
    case 'youtube': {
      container.classList.add('glarity--chatgpt--youtube')
      waitForElm('#secondary.style-scope.ytd-watch-flexy').then(() => {
        document.querySelector('#secondary.style-scope.ytd-watch-flexy')?.prepend(container)
      })
      break
    }
    case 'bilibili': {
      container.classList.add('glarity--chatgpt--bilibili')

      waitForElm(siteConfig.extabarContainerQuery?.[0]).then(() => {
        if (pageKey && getBiliPageKey(window.location.href) !== pageKey) return
        container.classList.add('glarity--chatgpt--bilibili')
        const appendContainer = getPossibleElementByQuerySelector(
          siteConfig.extabarContainerQuery || [],
        )
        appendContainer?.insertAdjacentElement('beforebegin', container)
      })
      break
    }
    default: {
      if (siteName === 'bing') {
        if (!/bing.com\/search\?/g.test(location.href)) {
          return
        }
        container.classList.add('glarity--chatgpt--bing')
      }

      const siderbarContainer = siteConfig.isSearchEngine
        ? await getSearchSidebar(siteName, siteConfig.sidebarContainerQuery)
        : getPossibleElementByQuerySelector(siteConfig.sidebarContainerQuery)

      if (siderbarContainer) {
        if (siteConfig.isSearchEngine) {
          container.classList.add(
            'glarity--search-sidebar-item',
            `glarity--search-sidebar-item--${siteName}`,
          )
          // Keep existing search-engine cards (including Glarity) above ours.
          const braveMainSidebar =
            siteName === 'brave'
              ? siderbarContainer.querySelector(':scope > #mixed-side')
              : undefined
          if (braveMainSidebar) {
            siderbarContainer.insertBefore(container, braveMainSidebar)
          } else if (siteName === 'baidu' || siteName === 'bing') {
            const glarityCard = siderbarContainer.querySelector(
              ':scope > #glarity--custom__summary',
            )
            if (glarityCard) {
              glarityCard.insertAdjacentElement('afterend', container)
            } else {
              siderbarContainer.prepend(container)
            }
          } else {
            siderbarContainer.appendChild(container)
          }
        } else {
          siderbarContainer.prepend(container)
        }
      } else {
        if (
          siteConfig.extabarContainerQuery &&
          document.querySelector('#center_col')?.nextSibling
        ) {
          container.classList.add('glarity--full-container')
          const appendContainer = getPossibleElementByQuerySelector(
            siteConfig.extabarContainerQuery,
          )
          if (appendContainer) {
            appendContainer.appendChild(container)
          }
        } else {
          const appendContainer = getPossibleElementByQuerySelector(siteConfig.appendContainerQuery)
          if (appendContainer) {
            container.classList.add('sidebar--free')
            appendContainer.appendChild(container)
          }
        }
      }
    }
  }

  render(
    <ChatGPTContainer
      question={question}
      transcript={transcript}
      siteConfig={siteConfig}
      langOptionsWithLink={langOptionsWithLink}
      contentNotice={contentNotice}
      pageKey={pageKey}
      triggerMode={userConfig.triggerMode || 'always'}
    />,
    container,
  )
}
