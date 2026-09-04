'use client'

import { useExtracted } from 'next-intl'
import { useEffect, useId, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { usePublicRuntimeConfig } from '@/hooks/usePublicRuntimeConfig'
import { cn } from '@/lib/utils'

const DEFAULT_MESSAGE = `{
  "type": "subscribe",
  "channel": "events"
}`

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
type LogLevel = 'system' | 'sent' | 'received' | 'error'

interface LogEntry {
  id: number
  level: LogLevel
  message: string
  timestamp: number
}

interface WebSocketPlaygroundProps {
  endpoint?: string
  defaultMessage?: string
  authQueryKey?: string
  maxLogs?: number
  className?: string
}

function buildSocketUrl(endpoint: string, token: string, authQueryKey: string) {
  if (!token) {
    return endpoint
  }

  try {
    const url = new URL(endpoint)
    url.searchParams.set(authQueryKey, token)
    return url.toString()
  } catch {
    return endpoint
  }
}

function getStatusBadgeVariant(status: ConnectionStatus) {
  if (status === 'connected') {
    return 'default'
  }

  if (status === 'connecting') {
    return 'secondary'
  }

  if (status === 'error') {
    return 'destructive'
  }

  return 'outline'
}

function getLogClass(level: LogLevel) {
  if (level === 'sent') {
    return 'text-blue-700 dark:text-blue-300'
  }

  if (level === 'received') {
    return 'text-yes dark:text-green-300'
  }

  if (level === 'error') {
    return 'text-destructive'
  }

  return 'text-muted-foreground'
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString()
}

function useWebSocketState(endpoint: string, defaultMessage: string) {
  const [url, setUrl] = useState(endpoint)
  const [token, setToken] = useState('')
  const [message, setMessage] = useState(defaultMessage)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const socketRef = useRef<WebSocket | null>(null)
  const nextLogIdRef = useRef(0)
  const instanceId = useId()

  useEffect(function cleanupSocketOnUnmount() {
    return function cleanup() {
      const socket = socketRef.current
      socketRef.current = null

      if (!socket) {
        return
      }

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Component unmounted')
      }
    }
  }, [])

  return {
    url,
    setUrl,
    token,
    setToken,
    message,
    setMessage,
    status,
    setStatus,
    logs,
    setLogs,
    errorMessage,
    setErrorMessage,
    socketRef,
    nextLogIdRef,
    instanceId,
  }
}

export function WebSocketPlayground({
  endpoint,
  defaultMessage = DEFAULT_MESSAGE,
  authQueryKey = 'token',
  maxLogs = 120,
  className,
}: WebSocketPlaygroundProps) {
  const t = useExtracted()
  const { wsLiveDataUrl } = usePublicRuntimeConfig()
  const resolvedEndpoint = endpoint ?? wsLiveDataUrl
  const {
    url,
    setUrl,
    token,
    setToken,
    message,
    setMessage,
    status,
    setStatus,
    logs,
    setLogs,
    errorMessage,
    setErrorMessage,
    socketRef,
    nextLogIdRef,
    instanceId,
  } = useWebSocketState(resolvedEndpoint, defaultMessage)
  const logLimit = Math.max(maxLogs, 10)
  const statusLabel = {
    disconnected: t('Disconnected'),
    connecting: t('Connecting'),
    connected: t('Connected'),
    error: t('Error'),
  }[status]
  const logLevelLabels = {
    system: t('System'),
    sent: t('Sent'),
    received: t('Received'),
    error: t('Error'),
  }

  function pushLog(level: LogLevel, entryMessage: string) {
    setLogs((prev) => {
      const next = [
        ...prev,
        {
          id: nextLogIdRef.current++,
          level,
          message: entryMessage,
          timestamp: Date.now(),
        },
      ]

      if (next.length <= logLimit) {
        return next
      }

      return next.slice(next.length - logLimit)
    })
  }

  function connect() {
    if (socketRef.current) {
      return
    }

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      const nextError = t('Provide a WebSocket URL before connecting.')
      setErrorMessage(nextError)
      pushLog('error', nextError)
      return
    }

    setErrorMessage('')
    setStatus('connecting')

    const socketUrl = buildSocketUrl(trimmedUrl, token.trim(), authQueryKey)
    pushLog('system', t('Connecting to {url}', { url: socketUrl }))

    try {
      const socket = new WebSocket(socketUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setStatus('connected')
        pushLog('system', t('Connection opened'))
      }

      socket.onmessage = (event) => {
        const payload = typeof event.data === 'string' ? event.data : t('[binary payload]')
        pushLog('received', payload)
      }

      socket.onerror = () => {
        setStatus('error')
        const nextError = t('Connection failed. Check endpoint and auth settings.')
        setErrorMessage(nextError)
        pushLog('error', nextError)
      }

      socket.onclose = (event) => {
        socketRef.current = null
        setStatus('disconnected')
        pushLog(
          'system',
          event.reason
            ? t('Connection closed ({code}): {reason}', { code: String(event.code), reason: event.reason })
            : t('Connection closed ({code})', { code: String(event.code) }),
        )
      }
    } catch (error) {
      socketRef.current = null
      setStatus('error')
      const nextError = error instanceof Error ? error.message : t('Unable to create WebSocket connection.')
      setErrorMessage(nextError)
      pushLog('error', nextError)
    }
  }

  function disconnect() {
    const socket = socketRef.current
    if (!socket) {
      return
    }

    socket.close(1000, t('Closed from playground'))
  }

  function sendMessage() {
    const payload = message.trim()
    if (!payload) {
      const nextError = t('Message payload cannot be empty.')
      setErrorMessage(nextError)
      pushLog('error', nextError)
      return
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      const nextError = t('Connect to the socket before sending a message.')
      setErrorMessage(nextError)
      pushLog('error', nextError)
      return
    }

    socket.send(payload)
    pushLog('sent', payload)
    setErrorMessage('')
  }

  function clearLogs() {
    setLogs([])
  }

  const isConnected = status === 'connected'
  const previewUrl = buildSocketUrl(url.trim(), token.trim(), authQueryKey)

  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold">{t('WebSocket Playground')}</h4>
          <p className="text-xs text-muted-foreground">
            {t(
              'Browser sockets cannot set custom Authorization headers. This widget appends the token as a query param.',
            )}
          </p>
        </div>
        <Badge variant={getStatusBadgeVariant(status)}>{statusLabel}</Badge>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-url`}>{t('WebSocket URL')}</Label>
            <Input
              id={`${instanceId}-url`}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={resolvedEndpoint}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-token`}>{t('Token ({key} query param)', { key: authQueryKey })}</Label>
            <Input
              id={`${instanceId}-token`}
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={t('Optional')}
            />
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs break-all">
          {previewUrl || t('Provide a valid WebSocket URL')}
        </div>

        <div className="flex flex-wrap gap-2">
          {!isConnected && (
            <Button type="button" onClick={connect}>
              {t('Connect')}
            </Button>
          )}
          {isConnected && (
            <Button type="button" variant="secondary" onClick={disconnect}>
              {t('Disconnect')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={clearLogs}>
            {t('Clear Logs')}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${instanceId}-payload`}>{t('Message Payload')}</Label>
          <Textarea
            id={`${instanceId}-payload`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            className="font-mono text-xs"
            placeholder={t('JSON payload or plain text')}
          />
          <Button type="button" onClick={sendMessage}>
            {t('Send Message')}
          </Button>
        </div>

        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('Connection Log')}</p>
          <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
            {logs.length === 0 && <p className="text-muted-foreground">{t('No events yet.')}</p>}
            <div className="space-y-1">
              {logs.map((entry) => (
                <div key={entry.id} className={cn('wrap-break-word whitespace-pre-wrap', getLogClass(entry.level))}>
                  {`[${formatTime(entry.timestamp)}] [${logLevelLabels[entry.level]}] ${entry.message}`}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
