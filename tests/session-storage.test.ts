import { describe, expect, it } from "vitest";
import { loadStringMap, persistStringMap, type KeyValueStorage } from "../src/session-storage";

describe("session storage maps", () => {
  it("round-trips valid entries and ignores malformed payload data", () => {
    let value: string | null = '[["valid","source"],["missing"],[1,"wrong"]]';
    const storage: KeyValueStorage = {
      getItem: () => value,
      setItem: (_key, next) => { value = next; },
    };

    expect([...loadStringMap(storage, "library")]).toEqual([["valid", "source"]]);
    expect(persistStringMap(storage, "library", new Map([["asset", "clipboard"]]))).toBe(true);
    expect([...loadStringMap(storage, "library")]).toEqual([["asset", "clipboard"]]);

    value = "{invalid";
    expect(loadStringMap(storage, "library").size).toBe(0);
  });

  it("reports quota-style write failures without losing the in-memory map", () => {
    const definitions = new Map([["asset", "clipboard"]]);
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); },
    };

    expect(persistStringMap(storage, "library", definitions)).toBe(false);
    expect(definitions.get("asset")).toBe("clipboard");
  });
});
