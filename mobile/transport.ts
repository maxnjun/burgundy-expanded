import type {HttpOptions, HttpResponse} from '@capacitor/core';

/** Native HTTP bypasses only WebView interception; server auth/revisions stay intact. */
export async function nativeRequest(request: Request, send: (options: HttpOptions) => Promise<HttpResponse>): Promise<Response> {
  request.signal.throwIfAborted();
  const headers = Object.fromEntries(request.headers.entries());
  headers.Origin = new URL(request.url).origin;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const response = send({url: request.url, method: request.method, headers,
    ...(body ? {data: body} : {}), responseType: 'text', connectTimeout: 15_000, readTimeout: 15_000, disableRedirects: true});
  let abort: (() => void) | undefined;
  try {
    const result = await Promise.race([response, new Promise<never>((_, reject) => {
      abort = () => reject(request.signal.reason ?? new DOMException('Aborted', 'AbortError'));
      request.signal.addEventListener('abort', abort, {once: true});
      if (request.signal.aborted) abort();
    })]);
    // A timed-out POST may still commit; the existing persistent requestId handles replay.
    return new Response(typeof result.data === 'string' ? result.data : JSON.stringify(result.data), {status: result.status, headers: result.headers});
  } finally {if (abort) request.signal.removeEventListener('abort', abort);}
}
