import { executeRegex, type RegexRequest, type RegexReply } from '../lib/regex';

self.onmessage = (event: MessageEvent<{ id: number; request: RegexRequest }>) => {
  const { id, request } = event.data;
  let reply: RegexReply;
  try {
    reply = { id, ok: true, result: executeRegex(request) };
  } catch (error) {
    reply = { id, ok: false, error: `정규식 실행 오류: ${error instanceof Error ? error.message.slice(0, 2000) : '알 수 없는 오류'}` };
  }
  self.postMessage(reply);
};
