import type { ChangeEvent } from 'react'
import { useCallback } from 'preact/hooks'
import { Text, Code, Textarea, Card, Button, Snippet, Collapse, useToasts } from '@geist-ui/core'
import { Space } from 'antd'
import { updateUserConfig } from '@/config'
import { isIOS, changeToast } from '@/utils/utils'
import {
  videoSummaryPromptHightligt,
  searchPromptHighlight,
  pageSummaryPromptHighlight,
  commentSummaryPromptHightligt,
  customizePrompt,
  customizePromptSearch,
  customizePrompt1,
  customizePromptClickbait,
  customizePromptPage,
  customizePromptComment,
  customizePromptCommentAmazon,
  customizePromptCommentYoutube,
} from '@/utils/prompt'

interface Props {
  prompt: string
  setPrompt: (prompt: string) => void
  promptSearch: string
  setPromptSearch: (promptSearch: string) => void
  promptPage: string
  setPromptPage: (promptPage: string) => void
  promptComment: string
  setPromptComment: (promptComment: string) => void
}

type PromptType = 'video' | 'search' | 'page' | 'comment'

function CustomizePrompt(props: Props) {
  const {
    prompt,
    setPrompt,
    promptSearch,
    setPromptSearch,
    promptPage,
    setPromptPage,
    promptComment,
    setPromptComment,
  } = props
  const { setToast } = useToasts()

  const onPromptChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>, type: PromptType) => {
      const prompt = e.currentTarget.value
      switch (type) {
        case 'search': {
          setPromptSearch(prompt)
          break
        }

        case 'page': {
          setPromptPage(prompt)
          break
        }

        case 'comment': {
          setPromptComment(prompt)
          break
        }

        case 'video': {
          setPrompt(prompt)
          break
        }
      }
    },
    [setPrompt, setPromptSearch, setPromptPage, setPromptComment],
  )

  const onSetPrompt = useCallback(
    async (type: PromptType) => {
      switch (type) {
        case 'search': {
          setPromptSearch(searchPromptHighlight)
          await updateUserConfig({ promptSearch: searchPromptHighlight })
          break
        }

        case 'page': {
          setPromptPage(pageSummaryPromptHighlight)
          await updateUserConfig({ promptPage: pageSummaryPromptHighlight })
          break
        }

        case 'comment': {
          setPromptComment(commentSummaryPromptHightligt)
          await updateUserConfig({ promptComment: commentSummaryPromptHightligt })
          break
        }

        case 'video': {
          setPrompt(videoSummaryPromptHightligt)
          await updateUserConfig({ prompt: videoSummaryPromptHightligt })
          break
        }
      }

      setToast(changeToast)
    },
    [setPrompt, setPromptComment, setPromptPage, setPromptSearch, setToast],
  )

  const onSavePrompt = useCallback(
    async (type: PromptType) => {
      const updates = {
        video: { prompt },
        search: { promptSearch },
        page: { promptPage },
        comment: { promptComment },
      }[type]

      await updateUserConfig(updates)
      setToast(changeToast)
    },
    [prompt, promptComment, promptPage, promptSearch, setToast],
  )

  return (
    <>
      {!isIOS && (
        <>
          <Text h3 className="glarity--mt-5 glarity--mb-0">
            Customize Prompt for Summary
          </Text>
          <Collapse.Group>
            {/* YouTube */}
            <Collapse title="YouTube / Bilibili">
              <Card className="glarity--card">
                <Text className="glarity--my-1">
                  <Code block my={0}>
                    {customizePrompt}
                  </Code>
                </Text>

                <Textarea
                  placeholder="Please enter a Prompt."
                  value={prompt}
                  resize={'vertical'}
                  onChange={(e) => {
                    onPromptChange(e, 'video')
                  }}
                />

                <Card.Footer>
                  <Space>
                    <Button
                      type="secondary"
                      auto
                      scale={1 / 3}
                      onClick={() => void onSavePrompt('video')}
                    >
                      Save
                    </Button>{' '}
                    <Button
                      type="secondary"
                      ghost
                      auto
                      scale={1 / 3}
                      onClick={() => void onSetPrompt('video')}
                    >
                      Use default
                    </Button>
                  </Space>
                </Card.Footer>
              </Card>
              <Text className="glarity--my-1">Example Prompts: </Text>
              <ul className="glarity--prompt__list">
                <li>
                  <Snippet symbol="" type="secondary">
                    Summarize the above content highlights.
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    Summarize the above in 3 bullet points.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    {`What's key takeaways from the above?`}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    Extract the gist of the above.
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    {customizePrompt1}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="success">
                    {customizePromptClickbait}
                  </Snippet>
                </li>
              </ul>
            </Collapse>

            {/* Google */}
            <Collapse title="Google / Bing">
              <Card className="glarity--card">
                <Text className="glarity--my-1">
                  <Code block my={0}>
                    {customizePromptSearch}
                  </Code>
                </Text>

                <Textarea
                  placeholder="Please enter a Prompt."
                  value={promptSearch}
                  resize={'vertical'}
                  onChange={(e) => {
                    onPromptChange(e, 'search')
                  }}
                />

                <Card.Footer>
                  <Space>
                    <Button
                      type="secondary"
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        void onSavePrompt('search')
                      }}
                    >
                      Save
                    </Button>{' '}
                    <Button
                      type="secondary"
                      ghost
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        void onSetPrompt('search')
                      }}
                    >
                      Use default
                    </Button>
                  </Space>
                </Card.Footer>
              </Card>
              <Text className="glarity--my-1">Example Prompts: </Text>
              <ul className="glarity--prompt__list">
                <li>
                  <Snippet symbol="" type="secondary">
                    Summarize the above content highlights.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    Summarize the above in 3 bullet points.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    {`What's key takeaways from the above?`}{' '}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    Extract the gist of the above.
                  </Snippet>
                </li>
              </ul>
            </Collapse>

            {/* Page Summary */}
            <Collapse title="Page Summary">
              <Card className="glarity--card">
                <Text className="glarity--my-1">
                  <Code block my={0}>
                    {customizePromptPage}
                  </Code>
                </Text>

                <Textarea
                  placeholder="Please enter a Prompt."
                  value={promptPage}
                  resize={'vertical'}
                  onChange={(e) => {
                    onPromptChange(e, 'page')
                  }}
                />

                <Card.Footer>
                  <Space>
                    <Button
                      type="secondary"
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        void onSavePrompt('page')
                      }}
                    >
                      Save
                    </Button>{' '}
                    <Button
                      type="secondary"
                      ghost
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        void onSetPrompt('page')
                      }}
                    >
                      Use default
                    </Button>
                  </Space>
                </Card.Footer>
              </Card>
              <Text className="glarity--my-1">Example Prompts: </Text>
              <ul className="glarity--prompt__list">
                <li>
                  <Snippet symbol="" type="secondary">
                    Summarize the above content highlights.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    Summarize the above in 3 bullet points.{' '}
                  </Snippet>
                </li>
                <li>
                  {' '}
                  <Snippet symbol="" type="secondary">
                    {`What's key takeaways from the above?`}{' '}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    Extract the gist of the above.
                  </Snippet>
                </li>
              </ul>
            </Collapse>

            {/* Comment Summary */}
            <Collapse
              title="Comment Summary"
              subtitle="Summary of support for Amazon products and YouTube video comments."
            >
              <Card className="glarity--card">
                <Text className="glarity--my-1">
                  <Code block my={0}>
                    {customizePromptComment}
                  </Code>
                </Text>

                <Textarea
                  placeholder="Please enter a Prompt."
                  value={promptComment}
                  resize={'vertical'}
                  onChange={(e) => {
                    onPromptChange(e, 'comment')
                  }}
                />

                <Card.Footer>
                  <Space>
                    <Button
                      type="secondary"
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        void onSavePrompt('comment')
                      }}
                    >
                      Save
                    </Button>{' '}
                    <Button
                      type="secondary"
                      ghost
                      auto
                      scale={1 / 3}
                      onClick={() => {
                        void onSetPrompt('comment')
                      }}
                    >
                      Use default
                    </Button>
                  </Space>
                </Card.Footer>
              </Card>
              <Text className="glarity--my-1">Example Prompts: </Text>
              <ul className="glarity--prompt__list">
                <li>
                  <Snippet symbol="" type="secondary">
                    {customizePromptCommentAmazon}
                  </Snippet>
                </li>
                <li>
                  <Snippet symbol="" type="secondary">
                    {customizePromptCommentYoutube}
                  </Snippet>
                </li>
              </ul>
            </Collapse>
          </Collapse.Group>
        </>
      )}
    </>
  )
}

export default CustomizePrompt
