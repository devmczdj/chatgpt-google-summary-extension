import Browser from 'webextension-polyfill'
import { apiHostOriginPattern } from '@/config'

export async function hasApiHostPermission(apiUrl: string): Promise<boolean> {
  const origins = [apiHostOriginPattern(apiUrl)]
  return Browser.permissions.contains({ origins })
}

/** Request optional host access. Must run from a user-gesture context (options Save). */
export async function ensureApiHostPermission(apiUrl: string): Promise<boolean> {
  const origins = [apiHostOriginPattern(apiUrl)]
  const already = await Browser.permissions.contains({ origins })
  if (already) {
    return true
  }
  return Browser.permissions.request({ origins })
}
