export function normalizeChatCompletionsUrl(value: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API URL must use http:// or https://')
  }

  // URL.pathname is never empty in the WHATWG URL API (hostname-only becomes "/"),
  // so keep the trimmed path in a local string before deciding.
  const pathname = url.pathname.replace(/\/$/, '') || '/'
  if (pathname.endsWith('/chat/completions')) {
    url.pathname = pathname
    return url.toString()
  }

  // Hostname-only bases (OpenAI, DeepSeek, Ollama, etc.) use /v1.
  // Custom bases that already include a path, such as GLM /api/paas/v4, keep it.
  if (pathname === '/') {
    url.pathname = '/v1/chat/completions'
  } else {
    url.pathname = `${pathname}/chat/completions`
  }
  return url.toString()
}
