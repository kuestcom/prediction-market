import type { ComponentPropsWithoutRef } from 'react'
import { createElement } from 'react'

export default function OgImage(props: ComponentPropsWithoutRef<'img'>) {
  return createElement('img', props)
}
