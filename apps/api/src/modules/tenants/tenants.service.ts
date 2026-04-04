import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";

import { ControlPlanePrismaService } from "../../config/control-plane.module";
import { ProvisioningService } from "./provisioning.service";

const RESERVED_SLUGS = new Set([
  "app", "www", "api", "mail", "admin", "status",
  "help", "support", "billing", "docs", "blog",
]);

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly controlDb: ControlPlanePrismaService,
    private readonly provisioning: ProvisioningService,
  ) {}

  /** List all tenants with optional status filter */
  async findAll(status?: string) {
    const where = status ? { status: status as any } : {};
    return this.controlDb.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Get a single tenant by ID */
  async findOne(id: string) {
    const tenant = await this.controlDb.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  /** Find tenant by slug (used by middleware) */
  async findBySlug(slug: string) {
    return this.controlDb.tenant.findUnique({ where: { slug } });
  }

  /** Provision a new tenant — creates DB, schema, seeds, admin user */
  async provision(data: {
    name: string;
    slug: string;
    adminEmail: string;
    adminName: string;
    plan?: string;
  }) {
    const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "");

    if (slug.length < 3) {
      throw new BadRequestException("Slug must be at least 3 characters");
    }
    if (slug.length > 32) {
      throw new BadRequestException("Slug must be at most 32 characters");
    }
    if (RESERVED_SLUGS.has(slug)) {
      throw new ConflictException(`"${slug}" is a reserved subdomain`);
    }

    const existing = await this.controlDb.tenant.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(`Subdomain "${slug}" is already taken`);
    }

    const dbName = `vivi_${slug.replace(/-/g, "_")}`;

    // 1. Create tenant record (PROVISIONING)
    const tenant = await this.controlDb.tenant.create({
      data: {
        name: data.name,
        slug,
        dbName,
        adminEmail: data.adminEmail,
        adminName: data.adminName,
        plan: (data.plan as any) || "FREE_TRIAL",
        status: "PROVISIONING",
      },
    });

    try {
      // 2. Create database
      await this.provisioning.createDatabase(dbName);

      // 3. Push schema
      await this.provisioning.pushSchema(dbName);

      // 4. Seed defaults
      await this.provisioning.seedDefaults(dbName);

      // 5. Create admin user (password: {slug}1234)
      await this.provisioning.createAdminUser(
        dbName,
        data.adminEmail,
        data.adminName,
        slug,
      );

      // 6. Mark as ACTIVE
      const updated = await this.controlDb.tenant.update({
        where: { id: tenant!.id },
        data: { status: "ACTIVE" },
      });

      this.logger.log(`Tenant "${slug}" provisioned successfully`);
      return {
        ...updated,
        credentials: {
          username: data.adminEmail,
          password: `${slug}1234`,
        },
      };
    } catch (error) {
      // Rollback: mark as DEACTIVATED if provisioning fails
      this.logger.error(`Provisioning failed for "${slug}": ${error}`);
      await this.controlDb.tenant.update({
        where: { id: tenant!.id },
        data: { status: "DEACTIVATED" },
      });
      throw error;
    }
  }

  /** Update tenant status, plan, or settings */
  async update(
    id: string,
    data: { status?: string; plan?: string; settings?: any; name?: string },
  ) {
    const tenant = await this.findOne(id);
    return this.controlDb.tenant.update({
      where: { id: tenant!.id },
      data: data as any,
    });
  }

  /** Reset tenant admin password to {slug}1234 */
  async resetAdminPassword(id: string) {
    const tenant = await this.findOne(id);
    await this.provisioning.resetAdminPassword(tenant.dbName, tenant.slug);
    return {
      success: true,
      credentials: {
        username: tenant.adminEmail,
        password: `${tenant.slug}1234`,
      },
    };
  }

  /** Decommission tenant — drops DB and removes record */
  async decommission(id: string) {
    const tenant = await this.findOne(id);

    // Drop the tenant database
    try {
      await this.provisioning.dropDatabase(tenant.dbName);
    } catch (err) {
      this.logger.warn(`Failed to drop DB ${tenant.dbName}: ${err}`);
    }

    // Remove from control plane
    await this.controlDb.tenant.delete({ where: { id: tenant.id } });

    return { success: true, slug: tenant.slug };
  }

  /** Get aggregate stats for monitoring dashboard */
  async getStats() {
    const [total, active, suspended, provisioning] = await Promise.all([
      this.controlDb.tenant.count(),
      this.controlDb.tenant.count({ where: { status: "ACTIVE" } }),
      this.controlDb.tenant.count({ where: { status: "SUSPENDED" } }),
      this.controlDb.tenant.count({ where: { status: "PROVISIONING" } }),
    ]);
    return { total, active, suspended, provisioning };
  }
}
