import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Evaluate the TypeScript helper by stripping simple type annotations.
const sourcePath = path.resolve('src/config/api-url.ts')
const source = fs.readFileSync(sourcePath, 'utf8')
const js = source.replace(/: string/g, '')

const tmp = path.resolve('scripts/.normalize-url.tmp.mjs')
fs.writeFileSync(tmp, js)

const mod = await import(pathToFileURL(tmp).href)
const { normalizeChatCompletionsUrl } = mod

test('hostname-only DeepSeek base gets /v1/chat/completions', () => {
  assert.equal(
    normalizeChatCompletionsUrl('https://api.deepseek.com'),
    'https://api.deepseek.com/v1/chat/completions',
  )
})

test('DeepSeek /v1 base appends /chat/completions', () => {
  assert.equal(
    normalizeChatCompletionsUrl('https://api.deepseek.com/v1'),
    'https://api.deepseek.com/v1/chat/completions',
  )
})

test('OpenAI /v1 base appends /chat/completions', () => {
  assert.equal(
    normalizeChatCompletionsUrl('https://api.openai.com/v1'),
    'https://api.openai.com/v1/chat/completions',
  )
})

test('full chat/completions URL is unchanged', () => {
  assert.equal(
    normalizeChatCompletionsUrl('https://api.openai.com/v1/chat/completions'),
    'https://api.openai.com/v1/chat/completions',
  )
})

test('GLM custom path does not insert /v1', () => {
  assert.equal(
    normalizeChatCompletionsUrl('https://open.bigmodel.cn/api/paas/v4'),
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  )
})

test('local http gateway gets /v1/chat/completions', () => {
  assert.equal(
    normalizeChatCompletionsUrl('http://127.0.0.1:11434'),
    'http://127.0.0.1:11434/v1/chat/completions',
  )
})

test('trailing slash on base is stripped before append', () => {
  assert.equal(
    normalizeChatCompletionsUrl('https://api.deepseek.com/'),
    'https://api.deepseek.com/v1/chat/completions',
  )
})

fs.unlinkSync(tmp)
