# AI 网页总结

一个用于总结搜索结果、视频和任意网页的浏览器扩展。本分支保留 ChatGPT 网页接口，并将原来固定的 OpenAI 模型配置改为通用的 OpenAI 兼容接口。

## Provider

### ChatGPT 网页接口

复用浏览器中当前的 ChatGPT 登录状态。它属于非官方网页接口，可能随 ChatGPT 网页改版而暂时失效。

### OpenAI 兼容接口

设置页面允许自由填写：

- API Base URL 或完整的 `/chat/completions` 地址
- API Key（通过 `Authorization: Bearer ...` 发送）
- 模型名称

只要服务实现了 OpenAI Chat Completions 请求格式和 SSE 流式响应，就可以接入 OpenAI、DeepSeek、Kimi、MiMo、GLM 或自建网关。填写 Base URL 时，扩展会自动补全 `/chat/completions`。

| 服务 | Base URL 示例 |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com` |
| Kimi | `https://api.moonshot.ai/v1` |
| MiMo | `https://api.xiaomimimo.com/v1` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` |

具体模型名和接口可用性由服务商决定，请以其最新文档为准。

## 构建与安装

```bash
npm install
npm run build
```

- Chromium：在扩展管理页开启开发者模式，加载 `build/chromium/`。
- Firefox：在 `about:debugging` 中临时加载 `build/firefox.zip`。

由于兼容接口允许填写任意服务地址，扩展需要申请所有 URL 的主机访问权限。API Key 保存在浏览器扩展的本地存储中，请求由扩展直接发送至所选服务。

## 上游与许可

本项目基于 [sparticleinc/chatgpt-google-summary-extension](https://github.com/sparticleinc/chatgpt-google-summary-extension) 修改，并保留原项目的上游署名。

使用 [GPL-3.0](LICENSE) 许可证。
