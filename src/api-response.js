export function jsonOk(data, usage) {
  return Response.json({ success: true, data, usage }, { status: 200 });
}

export function jsonErr(status, code, message, usage) {
  const body = {
    success: false,
    error: { code, message },
  };
  if (usage !== undefined) {
    body.usage = usage;
  }
  return Response.json(body, { status });
}
