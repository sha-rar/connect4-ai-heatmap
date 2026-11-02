export type TTFlag = "EXACT" | "LOWER" | "UPPER";

export type TTEntry = {
  depth: number;
  score: number;
  flag: TTFlag;
};

export class TranspositionTable {
  private map = new Map<string, TTEntry>();

  get(key: string): TTEntry | undefined {
    return this.map.get(key);
  }

  set(key: string, entry: TTEntry): void {
    const existing = this.map.get(key);
    // Keep the deeper result
    if (!existing || entry.depth >= existing.depth) {
      this.map.set(key, entry);
    }
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}
