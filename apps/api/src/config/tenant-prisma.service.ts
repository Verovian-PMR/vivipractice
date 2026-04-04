import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

type CacheEntry = {
  client: PrismaClient;
  lastUsedAt: number;
};

@Injectable()
export class TenantPrismaService implements OnModuleDestroy {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxClients = 20;
  private readonly idleMs = 5 * 60 * 1000;
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupIdleClients();
    }, 60 * 1000);
  }

  async getClient(slug: string, dbName: string): Promise<PrismaClient> {
    const existing = this.cache.get(slug);
    if (existing) {
      existing.lastUsedAt = Date.now();
      this.cache.delete(slug);
      this.cache.set(slug, existing);
      return existing.client;
    }

    if (this.cache.size >= this.maxClients) {
      const oldest = this.cache.entries().next().value as
        | [string, CacheEntry]
        | undefined;
      if (oldest) {
        this.cache.delete(oldest[0]);
        await oldest[1].client.$disconnect();
      }
    }

    const client = new PrismaClient({
      datasourceUrl: this.toDbUrl(dbName),
    });
    await client.$connect();
    this.cache.set(slug, { client, lastUsedAt: Date.now() });
    return client;
  }

  async onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    const disconnects = Array.from(this.cache.values()).map((entry) =>
      entry.client.$disconnect(),
    );
    await Promise.all(disconnects);
    this.cache.clear();
  }

  private toDbUrl(dbName: string): string {
    const baseUrl = process.env.DATABASE_URL || "";
    return baseUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
  }

  private async cleanupIdleClients() {
    const now = Date.now();
    const staleKeys: string[] = [];
    for (const [slug, entry] of this.cache.entries()) {
      if (now - entry.lastUsedAt > this.idleMs) {
        staleKeys.push(slug);
      }
    }

    for (const slug of staleKeys) {
      const entry = this.cache.get(slug);
      if (!entry) continue;
      this.cache.delete(slug);
      await entry.client.$disconnect();
    }
  }
}
