export async function loadJsonData<T = unknown>(path: string): Promise<T> {
  // TODO: ajouter la gestion d'erreurs et la validation de schema.
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Impossible de charger le fichier JSON: ${path}`);
  }

  return (await response.json()) as T;
}
