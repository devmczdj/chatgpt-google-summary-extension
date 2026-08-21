import { Button, Card, Text, useToasts } from '@geist-ui/core'
import { useCallback, useEffect, useState } from 'preact/hooks'
import Browser from 'webextension-polyfill'
import { isFirefox } from '@/utils/utils'

const PAGE_SUMMARY_COMMAND = 'open-page-summary'

function PageSummaryComponent() {
  const [shortcut, setShortcut] = useState('Not set')
  const { setToast } = useToasts()

  const loadShortcut = useCallback(() => {
    Browser.commands
      .getAll()
      .then((commands) => {
        const command = commands.find(({ name }) => name === PAGE_SUMMARY_COMMAND)
        setShortcut(command?.shortcut || 'Not set')
      })
      .catch(() => setShortcut('Not set'))
  }, [])

  useEffect(() => {
    loadShortcut()
    window.addEventListener('focus', loadShortcut)
    return () => window.removeEventListener('focus', loadShortcut)
  }, [loadShortcut])

  const openShortcutSettings = useCallback(async () => {
    const url = isFirefox ? 'about:addons' : 'chrome://extensions/shortcuts'

    try {
      await Browser.tabs.create({ url })
    } catch (error) {
      setToast({
        text: `Open ${url} in the address bar to configure the shortcut.`,
        type: 'warning',
      })
    }
  }, [setToast])

  return (
    <>
      <Text h3 className="glarity--mt-5">
        Page Summary
      </Text>

      <Card>
        <Card.Content>
          <Text h4 className="glarity--mb-0">
            Open page summary
          </Text>
          <Text className="glarity--mt-1" font="13px">
            The floating page button is hidden permanently so it cannot cover website content. Open
            the summary from the browser extension icon or assign your own keyboard shortcut.
          </Text>
          <Text className="glarity--mb-3" font="13px">
            Current shortcut: <code>{shortcut}</code>
          </Text>
          <Button auto scale={2 / 3} type="success" onClick={openShortcutSettings}>
            Configure keyboard shortcut
          </Button>
        </Card.Content>
      </Card>
    </>
  )
}

export default PageSummaryComponent
