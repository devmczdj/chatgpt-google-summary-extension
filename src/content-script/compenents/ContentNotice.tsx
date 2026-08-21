import { AlertIcon } from '@primer/octicons-react'

interface Props {
  children?: string
}

export default function ContentNotice({ children }: Props) {
  if (!children) return null

  return (
    <p className="glarity--content-notice">
      <AlertIcon size={14} /> <span>{children}</span>
    </p>
  )
}
