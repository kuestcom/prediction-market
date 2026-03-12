import type { ReactNode } from 'react'
import './globals.css'

interface Props {
  children: ReactNode
}

export default function RootLayout({ children }: Props) {
  return children
}
