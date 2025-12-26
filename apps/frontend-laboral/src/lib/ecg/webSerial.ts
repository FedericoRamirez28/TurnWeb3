// src/lib/ecg/webSerial.ts

export type SerialOpenOptions = {
  baudRate: number
  dataBits?: 7 | 8
  stopBits?: 1 | 2
  parity?: 'none' | 'even' | 'odd'
  flowControl?: 'none' | 'hardware'
}

export type WebSerialSignals = {
  dataTerminalReady?: boolean // DTR
  requestToSend?: boolean // RTS
  break?: boolean
}

/**
 * Tipos mínimos para Web Serial sin depender de lib.dom.d.ts con SerialPort.
 */
export type WebSerialPort = {
  open: (options: {
    baudRate: number
    dataBits?: number
    stopBits?: number
    parity?: string
    flowControl?: string
  }) => Promise<void>
  close: () => Promise<void>
  readable: ReadableStream<Uint8Array> | null

  writable?: WritableStream<Uint8Array> | null
  setSignals?: (signals: WebSerialSignals) => Promise<void>
}

export type WebSerialNavigator = {
  requestPort: () => Promise<WebSerialPort>
}

export type SerialSession = {
  port: WebSerialPort
  reader: ReadableStreamDefaultReader<Uint8Array>
  close: () => Promise<void>
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

function getWebSerial(): WebSerialNavigator {
  // @ts-expect-error: navigator.serial no está tipado en algunos TS configs
  const serial = navigator.serial as WebSerialNavigator | undefined
  if (!serial) throw new Error('Web Serial no disponible en este navegador')
  return serial
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function requestAndOpenPort(opts: SerialOpenOptions): Promise<SerialSession> {
  const serial = getWebSerial()
  const port = await serial.requestPort()

  await port.open({
    baudRate: opts.baudRate,
    dataBits: opts.dataBits ?? 8,
    stopBits: opts.stopBits ?? 1,
    parity: opts.parity ?? 'none',
    flowControl: opts.flowControl ?? 'none',
  })

  if (!port.readable) {
    await port.close().catch(() => void 0)
    throw new Error('El puerto no expone stream readable')
  }

  const reader = port.readable.getReader()

  const close = async () => {
    // Cierre fuerte: cancelar lectura -> liberar lock -> cerrar -> pequeño delay
    try {
      await reader.cancel()
    } catch {
      void 0
    }

    try {
      reader.releaseLock()
    } catch {
      void 0
    }

    // CH340 a veces necesita un poco de tiempo entre close/open
    try {
      await port.close()
    } catch {
      void 0
    }

    await sleep(200)
  }

  return { port, reader, close }
}

export async function setPortSignals(port: WebSerialPort, dtr: boolean, rts: boolean): Promise<void> {
  try {
    await port.setSignals?.({
      dataTerminalReady: dtr,
      requestToSend: rts,
    })
  } catch {
    void 0
  }
}

export async function writeBytes(port: WebSerialPort, bytes: Uint8Array): Promise<void> {
  if (!port.writable) throw new Error('El puerto no soporta escritura (writable)')
  const writer = port.writable.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '')
  if (!clean.length) return new Uint8Array()
  if (clean.length % 2 !== 0) throw new Error('HEX inválido: cantidad impar de dígitos')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16)
  }
  return out
}

export function bytesToAsciiPreview(bytes: Uint8Array, maxLen = 800): string {
  const len = Math.min(bytes.length, maxLen)
  let out = ''
  for (let i = 0; i < len; i++) {
    const c = bytes[i]
    if (c === 9 || c === 10 || c === 13) out += String.fromCharCode(c)
    else if (c >= 32 && c <= 126) out += String.fromCharCode(c)
    else out += '.'
  }
  return out
}

export function bytesToHexPreview(bytes: Uint8Array, maxLen = 256): string {
  const len = Math.min(bytes.length, maxLen)
  let out = ''
  for (let i = 0; i < len; i++) {
    const h = bytes[i].toString(16).padStart(2, '0')
    out += h + (i % 16 === 15 ? '\n' : ' ')
  }
  return out.trim()
}
