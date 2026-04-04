import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

type TenantContext = {
  tenant?: {
    id: string;
    slug: string;
    status: string;
    dbName: string;
    adminEmail: string;
    adminName: string;
    plan: string;
  };
  tenantPrisma?: PrismaClient;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run(context: TenantContext, callback: () => void) {
    this.storage.run(context, callback);
  }

  getTenantPrisma(): PrismaClient | undefined {
    return this.storage.getStore()?.tenantPrisma;
  }

  getTenant() {
    return this.storage.getStore()?.tenant;
  }
}
