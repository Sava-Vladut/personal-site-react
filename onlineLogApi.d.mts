import type { IncomingMessage, ServerResponse } from 'node:http'

type OnlineLogHandlerOptions = {
  onlineLogPath: string
  onlineLogToken?: string
}

export function createOnlineLogHandler(
  options: OnlineLogHandlerOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void>
