export default async function genericCall(
  endpoint: string,
  method: string,
  headers: Headers,
  data: { args?: string; body?: object } = {}
): Promise<Response | null> {
  const res = await fetch(`${process.env.oxibooruInstance}/api/${endpoint}${data.args ?? ''}`, {
    method: method,
    body: data.body ? JSON.stringify(data.body) : undefined,
    headers: headers,
  });

  if (!res.ok) {
    console.warn(endpoint, res.statusText, await res.text(), data);
    return null;
  }

  return res;
}
