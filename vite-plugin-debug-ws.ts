import type { Plugin } from 'vite'
import { WebSocketServer, type WebSocket } from 'ws'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const WS_PATH = '/__debug_ws'
const LOG_PATH = process.env.HUDECK_DEBUG_LOG || '/tmp/hudeck-debug.log'

function appendLog(line: string) {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true })
    appendFileSync(LOG_PATH, `${line}\n`)
  } catch {
    // ignore disk errors in debug path
  }
  // Mirror to Vite stdout so Cloud Agent / terminal can tail live.
  console.log(`[debug-ws] ${line}`)
}

/** Dev-only: WebSocket sink at /__debug_ws on the Vite HTTP server. */
export function debugWsPlugin(): Plugin {
  return {
    name: 'hudeck-debug-ws',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true })
      const clients = new Set<WebSocket>()

      server.httpServer?.on('upgrade', (req, socket, head) => {
        const url = req.url ?? ''
        if (!url.startsWith(WS_PATH)) return
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req)
        })
      })

      wss.on('connection', (ws, req) => {
        clients.add(ws)
        const peer = req.socket.remoteAddress ?? '?'
        appendLog(
          JSON.stringify({
            t: Date.now(),
            kind: 'server',
            type: 'client_open',
            peer,
          }),
        )
        ws.send(
          JSON.stringify({
            t: Date.now(),
            kind: 'server',
            type: 'hello',
            msg: 'hudeck debug-ws ready',
            log: LOG_PATH,
          }),
        )

        ws.on('message', (data) => {
          const text = typeof data === 'string' ? data : data.toString('utf8')
          appendLog(text)
        })

        ws.on('close', () => {
          clients.delete(ws)
          appendLog(
            JSON.stringify({
              t: Date.now(),
              kind: 'server',
              type: 'client_close',
              peer,
            }),
          )
        })
      })

      appendLog(
        JSON.stringify({
          t: Date.now(),
          kind: 'server',
          type: 'listening',
          path: WS_PATH,
          log: LOG_PATH,
        }),
      )
    },
  }
}

export const DEBUG_WS_PATH = WS_PATH
export const DEBUG_LOG_PATH = LOG_PATH
