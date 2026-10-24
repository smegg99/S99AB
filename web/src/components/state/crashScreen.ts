// web/src/components/state/crashScreen.ts

/** Why UiCrashScreen opened. */
export type CrashScreenKind = 'config' | 'startup' | 'crash' | 'hang' | 'killed'

/** What UiCrashScreen shows; s99wails shell/crash.Report has this shape. */
export interface CrashScreenReport {
  kind: CrashScreenKind
  app: string
  version?: string
  file?: string
  /** The first line of the failure. */
  error?: string
  /** The full plain-text report, behind Details. */
  text?: string
  /** An address is set, so Email can run. */
  email?: boolean
  /** A log file exists, so Show log file can run. */
  logs?: boolean
  /** A hung app still runs: only Wait and Close and report are offered. */
  alive?: boolean
  /** The system killed the app for memory. */
  oom?: boolean
}

/** The screen's actions; a missing one hides its button. s99wails crashActions has this shape. */
export interface CrashScreenActions {
  /** Without it the screen copies through the browser clipboard. */
  copy?: () => Promise<boolean>
  /** The saved path, or '' when cancelled. */
  save?: () => Promise<string>
  email?: () => Promise<void>
  openLogs?: () => Promise<void>
  restart?: () => Promise<void>
  close?: () => Promise<void>
  /** Gives a hung app more time. */
  wait?: () => Promise<void>
  /** Closes a hung app; its report follows. */
  kill?: () => Promise<void>
}

type Translate = (key: string, fallback?: string, params?: Record<string, string | number>) => string

/** The screen's heading, message and window-title phrase for report; message replaces the kind's. */
export function crashTexts(t: Translate, report: CrashScreenReport, message?: string) {
  const app = { app: report.app }
  const hangStopped = report.kind === 'hang' && !report.alive
  const title = {
    config: t('crash.titleStart', 'The app could not start'),
    startup: t('crash.titleStart', 'The app could not start'),
    crash: t('crash.titleCrash', 'The app stopped unexpectedly'),
    hang: hangStopped ? t('crash.titleHangStopped', 'The app stopped responding') : t('crash.titleHang', 'The app is not responding'),
    killed: t('crash.titleKilled', 'The app closed unexpectedly'),
  }[report.kind]
  const window = {
    config: t('crash.windowStart', 'could not start'),
    startup: t('crash.windowStart', 'could not start'),
    crash: t('crash.windowCrash', 'crashed'),
    hang: hangStopped ? t('crash.windowHangStopped', 'stopped responding') : t('crash.windowHang', 'not responding'),
    killed: t('crash.windowKilled', 'closed unexpectedly'),
  }[report.kind]
  const kindMessage = {
    config: () => t('crash.messageConfig', 'The settings file could not be read. Fix it or delete it, then start {app} again.', app),
    startup: () => t('crash.messageStartup', 'Fix the cause below, then start {app} again.', app),
    crash: () => t('crash.messageCrash', 'Something inside {app} failed. Send the report so it can be fixed, then restart.', app),
    hang: () => hangStopped
      ? t('crash.messageHangStopped', '{app} was closed while it was not responding. Send the report so it can be fixed, then restart.', app)
      : t('crash.messageHang', 'It may still finish what it is doing. Wait, or close it and send a report.'),
    killed: () => report.oom
      ? t('crash.messageOom', 'The system ran out of memory and closed {app}. Send the report, then restart.', app)
      : t('crash.messageKilled', '{app} was closed before it could report anything. Send the report so it can be fixed, then restart.', app),
  }[report.kind]
  return { title, window, message: message || kindMessage() }
}
