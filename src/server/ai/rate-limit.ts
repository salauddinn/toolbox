export type RateLimitConfig = {
  /** Analysis starts per client per hour. */
  maxStartsPerHour: number;
  /** Concurrent active runs per client. */
  maxActiveRunsPerClient: number;
  /** Process-wide active runs. */
  maxActiveRunsProcess: number;
  /** Authorize/generate calls per client per hour (AI spend control). */
  maxAuthorizesPerHour: number;
};

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  maxStartsPerHour: 3,
  maxActiveRunsPerClient: 1,
  maxActiveRunsProcess: 5,
  maxAuthorizesPerHour: 12,
};

type StartRecord = { timestamps: number[] };

/**
 * In-memory rate limiter for the long-lived process.
 */
export class RateLimiter {
  private readonly starts = new Map<string, StartRecord>();
  private readonly authorizes = new Map<string, StartRecord>();
  private readonly activeByClient = new Map<string, number>();
  private processActive = 0;
  private readonly config: RateLimitConfig;
  private readonly now: () => number;

  constructor(config: Partial<RateLimitConfig> = {}, now: () => number = Date.now) {
    this.config = { ...DEFAULT_RATE_LIMITS, ...config };
    this.now = now;
  }

  tryStart(clientKeyHash: string): { ok: true } | { ok: false; code: string; message: string } {
    this.prune(clientKeyHash);
    const record = this.starts.get(clientKeyHash) ?? { timestamps: [] };
    if (record.timestamps.length >= this.config.maxStartsPerHour) {
      return {
        ok: false,
        code: "RATE_LIMIT_STARTS",
        message: `At most ${this.config.maxStartsPerHour} analysis starts per client per hour`,
      };
    }
    const active = this.activeByClient.get(clientKeyHash) ?? 0;
    if (active >= this.config.maxActiveRunsPerClient) {
      return {
        ok: false,
        code: "RATE_LIMIT_ACTIVE_CLIENT",
        message: "Only one active run per client is allowed",
      };
    }
    if (this.processActive >= this.config.maxActiveRunsProcess) {
      return {
        ok: false,
        code: "RATE_LIMIT_ACTIVE_PROCESS",
        message: `At most ${this.config.maxActiveRunsProcess} active runs in this process`,
      };
    }

    record.timestamps.push(this.now());
    this.starts.set(clientKeyHash, record);
    this.activeByClient.set(clientKeyHash, active + 1);
    this.processActive += 1;
    return { ok: true };
  }

  /**
   * Gate AI generation / authorize calls to limit provider spend.
   */
  tryAuthorize(
    clientKeyHash: string,
  ): { ok: true } | { ok: false; code: string; message: string } {
    this.pruneAuthorizes(clientKeyHash);
    const record = this.authorizes.get(clientKeyHash) ?? { timestamps: [] };
    if (record.timestamps.length >= this.config.maxAuthorizesPerHour) {
      return {
        ok: false,
        code: "RATE_LIMIT_AUTHORIZE",
        message: `At most ${this.config.maxAuthorizesPerHour} generation authorizations per client per hour`,
      };
    }
    record.timestamps.push(this.now());
    this.authorizes.set(clientKeyHash, record);
    return { ok: true };
  }

  release(clientKeyHash: string): void {
    const active = this.activeByClient.get(clientKeyHash) ?? 0;
    if (active > 0) {
      this.activeByClient.set(clientKeyHash, active - 1);
      this.processActive = Math.max(0, this.processActive - 1);
    }
  }

  private prune(clientKeyHash: string): void {
    const hourAgo = this.now() - 60 * 60 * 1000;
    const record = this.starts.get(clientKeyHash);
    if (!record) return;
    record.timestamps = record.timestamps.filter((t) => t >= hourAgo);
    this.starts.set(clientKeyHash, record);
  }

  private pruneAuthorizes(clientKeyHash: string): void {
    const hourAgo = this.now() - 60 * 60 * 1000;
    const record = this.authorizes.get(clientKeyHash);
    if (!record) return;
    record.timestamps = record.timestamps.filter((t) => t >= hourAgo);
    this.authorizes.set(clientKeyHash, record);
  }

  /** Test helper. */
  reset(): void {
    this.starts.clear();
    this.authorizes.clear();
    this.activeByClient.clear();
    this.processActive = 0;
  }
}

export const globalRateLimiter = new RateLimiter();
