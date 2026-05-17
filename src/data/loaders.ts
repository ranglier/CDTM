export async function loadJsonData<T = unknown>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Impossible de charger ${path}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
