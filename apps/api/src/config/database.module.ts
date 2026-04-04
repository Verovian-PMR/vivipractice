import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { RequestContextService } from "./request-context.service";
import { TenantPrismaService } from "./tenant-prisma.service";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly requestContext: RequestContextService) {
    super();

    const passthroughKeys = new Set([
      "onModuleInit",
      "onModuleDestroy",
      "getClient",
      "requestContext",
      "constructor",
    ]);

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === "string" && passthroughKeys.has(prop)) {
          return Reflect.get(target, prop, receiver);
        }

        const activeClient = target.getClient();
        const value = (activeClient as any)[prop];
        if (typeof value === "function") {
          return value.bind(activeClient);
        }
        return value;
      },
    });
  }

  getClient(): PrismaClient {
    return this.requestContext.getTenantPrisma() ?? this;
  }

  async onModuleInit() {
    await super.$connect();
  }

  async onModuleDestroy() {
    await super.$disconnect();
  }
}

@Global()
@Module({
  providers: [RequestContextService, TenantPrismaService, PrismaService],
  exports: [RequestContextService, TenantPrismaService, PrismaService],
})
export class DatabaseModule {}
