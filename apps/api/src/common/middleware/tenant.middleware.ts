import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

import { ControlPlanePrismaService } from "../../config/control-plane.module";
import { RequestContextService } from "../../config/request-context.service";
import { TenantPrismaService } from "../../config/tenant-prisma.service";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly bypassHosts = new Set([
    "localhost",
    "127.0.0.1",
    "services.vivipractice.com",
    "dashboard.vivipractice.com",
    "app.vivipractice.com",
    "api.vivipractice.com",
  ]);

  private readonly bypassSlugs = new Set([
    "app",
    "www",
    "api",
    "mail",
    "admin",
    "status",
  ]);

  constructor(
    private readonly controlDb: ControlPlanePrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const hostHeader = (req.headers["x-forwarded-host"] || req.headers.host || "")
      .toString()
      .toLowerCase();
    const host = hostHeader.split(",")[0]?.trim().split(":")[0] || "";

    if (!host || this.bypassHosts.has(host) || !host.endsWith(".vivipractice.com")) {
      this.requestContext.run({}, () => next());
      return;
    }

    const slug = host.split(".")[0];
    if (!slug || this.bypassSlugs.has(slug)) {
      this.requestContext.run({}, () => next());
      return;
    }

    const tenant = await this.controlDb.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }

    if (tenant.status === "SUSPENDED" || tenant.status === "DEACTIVATED") {
      res.status(403).json({ message: "Tenant is not active" });
      return;
    }

    if (tenant.status === "PROVISIONING") {
      res.status(503).json({ message: "Tenant provisioning in progress" });
      return;
    }

    const tenantClient = await this.tenantPrisma.getClient(tenant.slug, tenant.dbName);
    (req as any).tenant = tenant;
    (req as any).tenantPrisma = tenantClient;

    this.requestContext.run(
      {
        tenant,
        tenantPrisma: tenantClient,
      },
      () => next(),
    );
  }
}
