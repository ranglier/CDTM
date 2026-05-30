export async function loadJsonData<T = unknown>(path: string): Promise<T> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Impossible de charger le fichier JSON: ${path}`);
  }

  return (await response.json()) as T;
}
