export function ok<T>(data: T, init: ResponseInit = {}): Response {
  return Response.json({ ok: true, data }, init);
}

export function err(
  code: string,
  message: string,
  status = 400,
  init: ResponseInit = {},
): Response {
  return Response.json({ ok: false, error: { code, message } }, { ...init, status });
}
