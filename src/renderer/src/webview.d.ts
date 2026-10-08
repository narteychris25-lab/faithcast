import type { DetailedHTMLProps, HTMLAttributes } from 'react'

/** Electron <webview> tag (Internet section and web slides). */
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
        httpreferrer?: string
        useragent?: string
      }
    }
  }
}

/** The subset of Electron's WebviewTag API the app uses. */
export interface WebviewEl extends HTMLElement {
  loadURL(url: string): Promise<void>
  getURL(): string
  getTitle(): string
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  stop(): void
  isLoading(): boolean
  executeJavaScript<T = unknown>(code: string): Promise<T>
  capturePage(): Promise<{ toDataURL(): string; isEmpty(): boolean }>
}
