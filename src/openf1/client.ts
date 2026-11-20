export const API = "https://api.openf1.org/v1";
const PAUSE_MS = 400; // between requests, to stay under OpenF1's free rate limit
const RETRIES = 4;
const MAX_WAIT_MS = 8000; // a resolver has 25 s in all

export interface Reply {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export type Fetcher = (url: string) => Promise<Reply>;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class OpenF1 {
  private last = 0;

  constructor(
    private readonly fetcher: Fetcher,
    private readonly sleep: (ms: number) => Promise<void> = pause,
  ) {}

  async get<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    );
    const url = `${API}/${path}?${query}`;
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const wait = this.last + PAUSE_MS - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();
      const reply = await this.fetcher(url);
      // OpenF1 answers 404 when a filter matches nothing.
      if (reply.status === 404) return [];
      if (reply.status === 429 || reply.status >= 500) {
        const after = Number(reply.headers.get("Retry-After"));
        await this.sleep(Math.min(MAX_WAIT_MS, after > 0 ? after * 1000 : 1000 * 2 ** attempt));
        continue;
      }
      if (reply.status >= 400) throw new Error(`OpenF1 answered ${reply.status} for ${path}.`);
      const body = await reply.json();
      return Array.isArray(body) ? (body as T[]) : [];
    }
    throw new Error(`OpenF1 kept refusing requests for ${path}. Try again in a minute.`);
  }
}
