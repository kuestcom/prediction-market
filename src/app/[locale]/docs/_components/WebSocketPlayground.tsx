'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const DEFAULT_MESSAGE = `{
  "type": "subscribe",
  "channel": "events"
}`
const DEFAULT_ENDPOINT = process.env.WS_LIVE_DATA_URL!

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
  }
  catch {
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

export function WebSocketPlayground({
  endpoint = DEFAULT_ENDPOINT,
  defaultMessage = DEFAULT_MESSAGE,
  authQueryKey = 'token',
  maxLogs = 120,
  className,
}: WebSocketPlaygroundProps) {
  const [url, setUrl] = useState(endpoint)
  const [token, setToken] = useState('')
  const [message, setMessage] = useState(defaultMessage)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  const socketRef = useRef<WebSocket | null>(null)
  const nextLogIdRef = useRef(0)
  const instanceId = useId()
  const logLimit = Math.max(maxLogs, 10)

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
      const nextError = 'Provide a WebSocket URL before connecting.'
      setErrorMessage(nextError)
      pushLog('error', nextError)
      return
    }

    setErrorMessage('')
    setStatus('connecting')

    const socketUrl = buildSocketUrl(trimmedUrl, token.trim(), authQueryKey)
    pushLog('system', `Connecting to ${socketUrl}`)

    try {
      const socket = new WebSocket(socketUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setStatus('connected')
        pushLog('system', 'Connection opened')
      }

      socket.onmessage = (event) => {
        const payload = typeof event.data === 'string'
          ? event.data
          : '[binary payload]'
        pushLog('received', payload)
      }

      socket.onerror = () => {
        setStatus('error')
        const nextError = 'Connection failed. Check endpoint and auth settings.'
        setErrorMessage(nextError)
        pushLog('error', nextError)
      }

      socket.onclose = (event) => {
        socketRef.current = null
        setStatus('disconnected')
        pushLog(
          'system',
          event.reason
            ? `Connection closed (${event.code}): ${event.reason}`
            : `Connection closed (${event.code})`,
        )
      }
    }
    catch (error) {
      socketRef.current = null
      setStatus('error')
      const nextError = error instanceof Error
        ? error.message
        : 'Unable to create WebSocket connection.'
      setErrorMessage(nextError)
      pushLog('error', nextError)
    }
  }

  function disconnect() {
    const socket = socketRef.current
    if (!socket) {
      return
    }

    socket.close(1000, 'Closed from playground')
  }

  function sendMessage() {
    const payload = message.trim()
    if (!payload) {
      const nextError = 'Message payload cannot be empty.'
      setErrorMessage(nextError)
      pushLog('error', nextError)
      return
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      const nextError = 'Connect to the socket before sending a message.'
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

  useEffect(() => {
    return () => {
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

  const isConnected = status === 'connected'
  const previewUrl = buildSocketUrl(url.trim(), token.trim(), authQueryKey)

  return (
    <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold">WebSocket Playground</h4>
          <p className="text-xs text-muted-foreground">
            Browser sockets cannot set custom Authorization headers. This widget appends the token as a query param.
          </p>
        </div>
        <Badge variant={getStatusBadgeVariant(status)}>
          {status[0].toUpperCase()}
          {status.slice(1)}
        </Badge>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-url`}>WebSocket URL</Label>
            <Input
              id={`${instanceId}-url`}
              value={url}
              onChange={event => setUrl(event.target.value)}
              placeholder={DEFAULT_ENDPOINT}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${instanceId}-token`}>
              Token (
              {authQueryKey}
              {' '}
              query param)
            </Label>
            <Input
              id={`${instanceId}-token`}
              type="password"
              value={token}
              onChange={event => setToken(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs break-all">
          {previewUrl || 'Provide a valid WebSocket URL'}
        </div>

        <div className="flex flex-wrap gap-2">
          {!isConnected && (
            <Button type="button" onClick={connect}>
              Connect
            </Button>
          )}
          {isConnected && (
            <Button type="button" variant="secondary" onClick={disconnect}>
              Disconnect
            </Button>
          )}
          <Button type="button" variant="outline" onClick={clearLogs}>
            Clear Logs
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${instanceId}-payload`}>Message Payload</Label>
          <Textarea
            id={`${instanceId}-payload`}
            value={message}
            onChange={event => setMessage(event.target.value)}
            rows={6}
            className="font-mono text-xs"
            placeholder="JSON payload or plain text"
          />
          <Button type="button" onClick={sendMessage}>
            Send Message
          </Button>
        </div>

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Connection Log</p>
          <div className="max-h-72 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
            {logs.length === 0 && (
              <p className="text-muted-foreground">No events yet.</p>
            )}
            <div className="space-y-1">
              {logs.map(entry => (
                <div key={entry.id} className={cn('wrap-break-word whitespace-pre-wrap', getLogClass(entry.level))}>
                  {`[${formatTime(entry.timestamp)}] [${entry.level.toUpperCase()}] ${entry.message}`}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
