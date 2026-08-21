import { waitForElm } from './utils'
import { queryParam } from 'gb-url'
import { getBiliVideoId } from '../utils/bilibili'
export interface SearchEngine {
  inputQuery: string[]
  sidebarContainerQuery: string[]
  appendContainerQuery: string[]
  extabarContainerQuery?: string[]
  contentContainerQuery: string[]
  watchRouteChange?: (callback: () => void) => void
  name?: string
  siteName: string
  siteValue: string
  regex: string
  searchRegExp?: string
  searchResultQuery?: string[]
  searchTitleQuery?: string[]
  searchSnippetQuery?: string[]
  searchLinkQuery?: string[]
  searchExcludeTemplates?: string[]
  isSearchEngine?: boolean
}

export const config: Record<string, SearchEngine> = {
  google: {
    isSearchEngine: true,
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    extabarContainerQuery: ['#extabar'],
    contentContainerQuery: [],
    name: 'gogole',
    siteName: 'Google',
    siteValue: 'google',
    regex: '(^(www.)?google.)',
    searchResultQuery: ['div.MjjYud'],
    searchTitleQuery: ['h3.LC20lb'],
    searchSnippetQuery: ['div.VwiC3b', 'span.ILfuVd', 'div.IThcWe'],
    searchLinkQuery: ['div.yuRUbf > a', 'h3 > a'],
  },
  bing: {
    isSearchEngine: true,
    inputQuery: ["[name='q']"],
    sidebarContainerQuery: ['ol#b_context'],
    appendContainerQuery: ['#b_content'],
    contentContainerQuery: [],
    siteName: 'Bing',
    siteValue: 'bing',
    regex: '(^(www|cn).?bing.com)',
    searchResultQuery: ['main > ol > li.b_algo', 'ol#b_results > li.b_algo'],
    searchTitleQuery: ['h2 a', '.b_title a'],
    searchSnippetQuery: ['.b_lineclamp2', '.b_lineclamp3', '.b_caption p'],
    searchLinkQuery: ['h2 a', '.b_title a'],
  },
  yahoo: {
    isSearchEngine: true,
    inputQuery: ["input[name='p']"],
    sidebarContainerQuery: ['#right', '.Contents__inner.Contents__inner--sub'],
    appendContainerQuery: ['#cols', '#contents__wrap'],
    contentContainerQuery: [],
    siteName: 'Yahoo!',
    siteValue: 'yahoo',
    regex: '(^(search.)?yahoo.)',
    searchResultQuery: ['#web ol > li', '.algo'],
    searchTitleQuery: ['h3 a', '.title a'],
    searchSnippetQuery: ['.compText', '.fc-falcon'],
    searchLinkQuery: ['h3 a', '.title a'],
  },
  duckduckgo: {
    isSearchEngine: true,
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: [
      'section[data-area="sidebar"]',
      'section[data-testid="sidebar"]',
      '.js-react-sidebar',
      '.results--sidebar.js-results-sidebar',
    ],
    appendContainerQuery: [],
    contentContainerQuery: [],
    siteName: 'DuckDuckGo',
    siteValue: 'duckduckgo',
    regex: '(^(www.)?duckduckgo.com)',
    searchResultQuery: ['article[data-testid="result"]', '.result'],
    searchTitleQuery: ['[data-testid="result-title-a"]', '.result__a'],
    searchSnippetQuery: ['[data-testid="result-snippet"]', '[data-result="snippet"]'],
    searchLinkQuery: ['[data-testid="result-title-a"]', '.result__a'],
  },
  baidu: {
    isSearchEngine: true,
    inputQuery: ["input[name='wd']"],
    sidebarContainerQuery: ['#content_right'],
    appendContainerQuery: ['#container'],
    contentContainerQuery: [],
    watchRouteChange(callback) {
      const targetNode = document.getElementById('wrapper_wrapper')!
      const observer = new MutationObserver(function (records) {
        for (const record of records) {
          if (record.type === 'childList') {
            for (const node of record.addedNodes) {
              if ('id' in node && node.id === 'container') {
                callback()
                return
              }
            }
          }
        }
      })
      observer.observe(targetNode, { childList: true })
    },
    siteName: 'Baidu',
    siteValue: 'baidu',
    regex: '(^(www.)?baidu.com)',
    searchResultQuery: ['#content_left > .result', '#content_left > .c-container'],
    searchTitleQuery: ['h3 a', 'h3'],
    searchSnippetQuery: ['.c-abstract', '[class*="content-right"]'],
    searchLinkQuery: ['h3 a', 'a[href]'],
    searchExcludeTemplates: ['recommend_list', 'ai_search_recommend', 'short_video'],
  },
  kagi: {
    isSearchEngine: true,
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['.right-content-box > ._0_right_sidebar'],
    appendContainerQuery: ['#_0_app_content'],
    contentContainerQuery: [],
    siteName: 'kagi',
    siteValue: 'kagi',
    regex: '(^(www.)?kagi.com)',
    searchResultQuery: ['.search-result'],
    searchTitleQuery: ['.search-result-title a', 'h3 a'],
    searchSnippetQuery: ['.search-result__snippet', '.search-result-snippet'],
    searchLinkQuery: ['.search-result-title a', 'h3 a'],
  },
  yandex: {
    isSearchEngine: true,
    inputQuery: ["input[name='text']"],
    sidebarContainerQuery: ['#search-result-aside'],
    appendContainerQuery: [],
    contentContainerQuery: [],
    siteName: 'Yandex',
    siteValue: 'yandex',
    regex: '(^(w+.)?yandex.)',
    searchResultQuery: ['.serp-item'],
    searchTitleQuery: ['.OrganicTitle-Link', 'h2 a'],
    searchSnippetQuery: ['.OrganicTextContentSpan', '.TextContainer'],
    searchLinkQuery: ['.OrganicTitle-Link', 'h2 a'],
  },
  naver: {
    isSearchEngine: true,
    inputQuery: ["input[name='query']"],
    sidebarContainerQuery: ['#sub_pack'],
    appendContainerQuery: ['#content'],
    contentContainerQuery: [],
    siteName: 'NAVER',
    siteValue: 'naver',
    regex: '(^(search.)?naver.com)',
    searchResultQuery: ['.api_subject_bx', '.sc_new .bx'],
    searchTitleQuery: ['.title_link', '.total_tit a'],
    searchSnippetQuery: ['.dsc_txt', '.api_txt_lines'],
    searchLinkQuery: ['.title_link', '.total_tit a'],
  },
  brave: {
    isSearchEngine: true,
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: [
      '.serp-layout > .serp-columns > .serp-columns-side',
      'aside.sidebar',
      '#side-right',
    ],
    appendContainerQuery: [],
    contentContainerQuery: [],
    siteName: 'Brave',
    siteValue: 'brave',
    regex: `(^(search.)?brave.com)`,
    searchResultQuery: ['[data-type="web"]'],
    searchTitleQuery: ['.search-snippet-title'],
    searchSnippetQuery: ['.generic-snippet', '.result-content > .content'],
    searchLinkQuery: ['a.l1', 'a[href]'],
  },
  searx: {
    isSearchEngine: true,
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#sidebar_results'],
    appendContainerQuery: [],
    contentContainerQuery: [],
    siteName: 'searX',
    siteValue: 'searx',
    regex: '(^(www.)?searx.be)',
    searchResultQuery: ['article.result'],
    searchTitleQuery: ['h3 a'],
    searchSnippetQuery: ['.content'],
    searchLinkQuery: ['h3 a'],
  },
  youtube: {
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    extabarContainerQuery: ['#extabar'],
    contentContainerQuery: [],
    name: 'youtube',
    watchRouteChange(callback) {
      let currentUrl = window.location.href

      setInterval(() => {
        const videoId = queryParam('v', window.location.href)
        if (window.location.href !== currentUrl && videoId) {
          waitForElm('#secondary.style-scope.ytd-watch-flexy').then(() => {
            if (document.querySelector('section.glarity--container')) {
              document.querySelector('section.glarity--container')?.remove()
            }
          })

          callback()
          currentUrl = window.location.href
        }
      }, 1000)
    },
    siteName: 'YouTube',
    siteValue: 'youtube',
    regex: '(^(www.)?youtube.com)',
  },
  yahooJpNews: {
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    extabarContainerQuery: ['#yjnFixableArea.sc-feJyhm'],
    contentContainerQuery: ['div.article_body'],
    name: 'yahooJpNews',
    siteName: 'Yahoo! JAPAN ニュース',
    siteValue: 'yahooJpNews',
    regex: '(^news.yahoo.co.jp)',
  },
  pubmed: {
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    // extabarContainerQuery: ['aside.page-sidebar > div.inner-wrap'],
    extabarContainerQuery: ['aside.page-sidebar', 'aside.pmc-sidebar'],
    contentContainerQuery: ['div#abstract'],
    name: 'pubmed',
    siteName: 'PubMed',
    siteValue: 'pubmed',
    regex: '((w+.)?ncbi.nlm.nih.gov)',
  },
  newspicks: {
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    extabarContainerQuery: ['div.right-container'],
    contentContainerQuery: ['div#body div.article-body'],
    name: 'newspicks',
    siteName: 'NewsPicks',
    siteValue: 'newspicks',
    regex: '(^(www.)?newspicks.com)',
  },
  nikkei: {
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    extabarContainerQuery: ['aside.aside_au9xyxw'],
    contentContainerQuery: ['section.container_c1suc6un'],
    name: 'nikkei',
    siteName: 'Nikkei',
    siteValue: 'nikkei',
    regex: '(^(www.)?nikkei.com)',
  },
  github: {
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    extabarContainerQuery: ['div.Layout-sidebar'],
    contentContainerQuery: ['div.Box-body'],
    name: 'github',
    siteName: 'GitHub',
    siteValue: 'github',
    regex: '(^(www.)?github.com)',
  },
  googlePatents: {
    inputQuery: ["input[name='q']"],
    sidebarContainerQuery: ['#rhs'],
    appendContainerQuery: ['#rcnt'],
    extabarContainerQuery: ['section.knowledge-card.patent-result'],
    contentContainerQuery: ['#descriptionText'],
    name: 'googlePatents',
    siteName: 'Google Patents',
    siteValue: 'googlePatents',
    regex: '(^(patents).google.com)',
    watchRouteChange(callback) {
      let currentUrl = window.location.href

      setInterval(() => {
        if (window.location.href !== currentUrl) {
          if (/patents.google.com\/patent\/\w+/g.test(location.href)) {
            waitForElm(config.googlePatents.extabarContainerQuery?.[0]).then(() => {
              if (document.querySelector('section.glarity--container')) {
                document.querySelector('section.glarity--container')?.remove()
              }
            })

            callback()
          }

          currentUrl = window.location.href
        }
      }, 1000)
    },
  },
  bilibili: {
    inputQuery: [],
    sidebarContainerQuery: [],
    appendContainerQuery: [],
    extabarContainerQuery: ['div.bpx-player-auxiliary'],
    contentContainerQuery: [],
    name: 'bilibili',
    siteName: 'Bilibili',
    siteValue: 'bilibili',
    regex: '(^(www.)?bilibili.com)',
    watchRouteChange(callback) {
      let currentUrl = window.location.href

      setInterval(() => {
        if (window.location.href !== currentUrl) {
          if (getBiliVideoId(location.href)) {
            waitForElm(config.bilibili.extabarContainerQuery?.[0]).then(() => {
              if (document.querySelector('section.glarity--container')) {
                document.querySelector('section.glarity--container')?.remove()
              }
            })

            callback()
          }

          currentUrl = window.location.href
        }
      }, 1000)
    },
  },
}
