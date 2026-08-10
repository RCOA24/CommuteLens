/**
 * Minimal in-process TTL cache with bounded size.
 *
 * Deliberately small: it exists so a demo geocode or route lookup is not
 * repeated on every keystroke or re-render. It is per-instance and per-process,
 * so it is safe to hold non-sensitive provider responses only. Never cache
 * precise user coordinates or anything derived from a secret.
 */
export class TtlCache<TValue> {
  private readonly entries = new Map<string, { value: TValue; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 200,
    private readonly now: () => number = Date.now,
  ) {
    if (ttlMs <= 0) throw new RangeError("Cache TTL must be positive.");
    if (maxEntries <= 0) throw new RangeError("Cache size must be positive.");
  }

  get(key: string): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh recency for the bounded-size eviction below.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: TValue): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
