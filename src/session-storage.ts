export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadStringMap(storage: KeyValueStorage, key: string): Map<string, string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.filter((entry): entry is [string, string] =>
      Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string",
    ));
  } catch {
    return new Map();
  }
}

export function persistStringMap(
  storage: KeyValueStorage,
  key: string,
  values: ReadonlyMap<string, string>,
): boolean {
  try {
    storage.setItem(key, JSON.stringify([...values]));
    return true;
  } catch {
    return false;
  }
}
