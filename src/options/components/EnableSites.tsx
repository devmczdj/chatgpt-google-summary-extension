import React from 'react'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { SearchEngine } from '@/content-script/search-engine-configs'
import { Text, Card, Button, Spacer, useToasts, Checkbox } from '@geist-ui/core'
import { updateUserConfig } from '@/config'
import { changeToast, isIOS } from '@/utils/utils'

interface Props {
  enableSites: string[]
  setEnableSites: (site: string[]) => void
  allSites: string[]
  supportSites: Record<string, SearchEngine>
}

function EnableSites(props: Props) {
  const { enableSites, setEnableSites, allSites, supportSites } = props
  const { setToast } = useToasts()
  const [allSelect, setAllSelect] = useState(true)

  const onSaveSelect = useCallback(() => {
    updateUserConfig({ enableSites })
    setToast(changeToast)
  }, [setToast, enableSites])

  const onChangeSites = (value) => {
    setEnableSites(value)
  }

  const onChangeSelectAll = (e) => {
    if (e.target.checked) {
      setEnableSites(allSites)
    } else {
      setEnableSites([])
    }
  }

  useEffect(() => {
    if (enableSites.length === allSites.length) {
      setAllSelect(true)
    } else {
      setAllSelect(false)
    }
  }, [enableSites, allSites])

  return (
    <>
      {!isIOS && (
        <>
          <Text h3 className="glarity--mt-5">
            Enable/Disable website integrations
            <Text font="12px" my={0}>
              Choose where search and video summaries are enabled.
            </Text>
          </Text>

          <Card>
            <Card.Content>
              <Checkbox.Group
                value={enableSites}
                onChange={onChangeSites}
                className="glarity--support__sites"
              >
                {Object.entries(supportSites).map(([key, site]) => (
                  <Checkbox
                    key={key}
                    value={site.siteValue}
                    className="glarity--support__sites--item"
                  >
                    {site.siteName}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Card.Content>
            <Card.Footer>
              <Checkbox checked={allSelect} value="selectAll" onChange={onChangeSelectAll}>
                Select All / Reverse
              </Checkbox>
              <Spacer w={2} />
              <Button type="secondary" auto scale={1 / 3} onClick={onSaveSelect}>
                Save
              </Button>
            </Card.Footer>
          </Card>
        </>
      )}
    </>
  )
}

export default EnableSites
