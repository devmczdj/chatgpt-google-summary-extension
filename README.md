# AI Page Summary

A browser extension that summarizes search results, videos, and webpages. This fork keeps the
ChatGPT web interface and adds a provider-neutral OpenAI-compatible API configuration.

## Providers

### ChatGPT web interface

Uses the current ChatGPT login session in the browser. This is an unofficial web interface and may
be less stable than an API.

### OpenAI-compatible API

The options page accepts all three values as free text:

- API Base URL or a complete `/chat/completions` endpoint
- API key (sent as `Authorization: Bearer ...`)
- Model name

This works with services that implement the OpenAI Chat Completions request and SSE streaming
format, including compatible endpoints from OpenAI, DeepSeek, Kimi, MiMo, GLM, and self-hosted
gateways. The extension appends `/chat/completions` when a base URL is entered.

Example base URLs:

| Provider | Base URL |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com` |
| Kimi | `https://api.moonshot.ai/v1` |
| MiMo | `https://api.xiaomimimo.com/v1` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` |

Model names and endpoint availability are controlled by each provider. Check the provider's current
documentation before saving the configuration.

## Build

```bash
npm install
npm run build
```

Load `build/chromium/` as an unpacked extension in Chromium, or load `build/firefox.zip` as a
temporary Firefox add-on.

The compatible API can point to any user-supplied host, so the extension requests all-URL host
permission. API keys are stored in the browser extension's local storage and requests are sent
directly to the selected endpoint.

## Upstream and license

This project is based on
[sparticleinc/chatgpt-google-summary-extension](https://github.com/sparticleinc/chatgpt-google-summary-extension),
which in turn credits
[wong2/chatgpt-google-extension](https://github.com/wong2/chatgpt-google-extension),
[qunash/chatgpt-advanced](https://github.com/qunash/chatgpt-advanced), and
[YouTube Summary with ChatGPT](https://github.com/kazuki-sf/YouTube_Summary_with_ChatGPT).

Licensed under [GPL-3.0](LICENSE).
