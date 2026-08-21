import { Button, Card, Input, Radio, Spinner, useInput, useToasts } from '@geist-ui/core'
import { FC, useCallback, useState } from 'react'
import useSWR from 'swr'
import {
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  getProviderConfigs,
  normalizeChatCompletionsUrl,
  ProviderConfigs,
  ProviderType,
  saveProviderConfigs,
} from '@/config'
import { isSafari } from '@/utils/utils'
import { ensureApiHostPermission } from '@/utils/api-host-permission'

interface ConfigProps {
  config: ProviderConfigs
}

const ConfigPanel: FC<ConfigProps> = ({ config }) => {
  const stored = config.configs[ProviderType.OpenAICompatible]
  const [provider, setProvider] = useState<ProviderType>(
    isSafari ? ProviderType.OpenAICompatible : config.provider,
  )
  const { bindings: apiUrlBindings } = useInput(stored?.apiUrl ?? DEFAULT_API_URL)
  const { bindings: apiKeyBindings } = useInput(stored?.apiKey ?? '')
  const { bindings: modelBindings } = useInput(stored?.model ?? DEFAULT_MODEL)
  const { setToast } = useToasts()

  const save = useCallback(async () => {
    const apiKey = apiKeyBindings.value.trim()
    const model = modelBindings.value.trim()
    let apiUrl = apiUrlBindings.value.trim()

    if (provider === ProviderType.OpenAICompatible) {
      if (!apiUrl || !apiKey || !model) {
        alert('API URL, API key, and model name are required.')
        return
      }
      try {
        apiUrl = normalizeChatCompletionsUrl(apiUrl)
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Invalid API URL')
        return
      }
      const granted = await ensureApiHostPermission(apiUrl)
      if (!granted) {
        alert('Host permission is required to call this API endpoint.')
        return
      }
    }

    await saveProviderConfigs(provider, {
      [ProviderType.OpenAICompatible]: { apiUrl, apiKey, model },
    })
    setToast({ text: 'Changes saved', type: 'success' })
  }, [apiKeyBindings.value, apiUrlBindings.value, modelBindings.value, provider, setToast])

  return (
    <Card className="glarity--card">
      <div className="glarity--flex glarity--flex-col glarity--gap-3">
        <Radio.Group value={provider} onChange={(value) => setProvider(value as ProviderType)}>
          {!isSafari && (
            <Radio value={ProviderType.ChatGPT}>
              ChatGPT web interface
              <Radio.Desc>
                Uses your ChatGPT login session. This unofficial interface may change or become
                temporarily unavailable.
              </Radio.Desc>
            </Radio>
          )}

          <Radio value={ProviderType.OpenAICompatible}>
            OpenAI-compatible API
            <Radio.Desc>
              <div className="glarity--flex glarity--flex-col glarity--gap-3 glarity--mt-2">
                <Input
                  htmlType="url"
                  label="API Base URL or endpoint"
                  placeholder={DEFAULT_API_URL}
                  width="100%"
                  clearable
                  {...apiUrlBindings}
                />
                <Input
                  htmlType="text"
                  label="Model name"
                  placeholder="gpt-4o-mini, deepseek-chat, kimi-k2.5, glm-4.5, ..."
                  width="100%"
                  clearable
                  {...modelBindings}
                />
                <Input.Password
                  label="API key"
                  placeholder="Enter the key issued by your API provider"
                  width="100%"
                  clearable
                  {...apiKeyBindings}
                />
                <span className="glarity--italic glarity--text-xs">
                  You may enter a base URL or a complete /chat/completions endpoint. The request is
                  sent directly from this extension with Bearer authentication. HTTP endpoints are
                  accepted for local services; use HTTPS for remote services.
                </span>
              </div>
            </Radio.Desc>
          </Radio>
        </Radio.Group>
        <Card.Footer>
          <Button scale={2 / 3} style={{ width: 20 }} type="success" onClick={save}>
            Save
          </Button>
        </Card.Footer>
      </div>
    </Card>
  )
}

function ProviderSelect() {
  const query = useSWR('provider-configs', getProviderConfigs)

  if (query.isLoading) {
    return <Spinner />
  }
  if (query.error) {
    return <div>Error loading provider configurations.</div>
  }
  if (!query.data) {
    return <div>No provider configurations found.</div>
  }

  return <ConfigPanel config={query.data} />
}

export default ProviderSelect
