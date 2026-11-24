export async function api(path: string, body?: unknown) {
  const response = await fetch('http://127.0.0.1:8787' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Tutor request failed.');
  return data;
}
