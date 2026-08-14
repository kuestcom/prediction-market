import localFont from 'next/font/local'

export const openSauceOne = localFont({
  src: [
    { path: '../../public/fonts/open-sauce-one-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/open-sauce-one-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/open-sauce-one-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/open-sauce-one-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sans',
})
