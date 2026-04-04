import { Global, Module, Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma client for the Control Plane database (tenant registry + super admins).
 * Uses a standard PrismaClient pointed at the control plane database URL.
 * The control schema mirrors the data-plane PrismaClient base but connects
 * to the control DB which has tenants + super_admins tables.
 *
 * We use raw queries and typed helpers instead of generated control-client
 * to avoid cross-workspace Prisma resolution issues.
 */
@Injectable()
export class ControlPlanePrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient;

  constructor() {
    this.client = new PrismaClient({
      datasourceUrl: process.env.CONTROL_PLANE_DATABASE_URL,
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  // ── Tenant operations ─────────────────────────────────────

  get tenant() {
    return {
      findMany: async (args?: any) => {
        if (args?.where?.status) {
          const rows = await this.client.$queryRawUnsafe(
            `SELECT * FROM tenants WHERE status = $1::"TenantStatus" ORDER BY created_at DESC`,
            args.where.status,
          ) as any[];
          return rows.map((row: any) => this.mapTenant(row));
        }
        const rows = await this.client.$queryRawUnsafe(
          `SELECT * FROM tenants ORDER BY created_at DESC`,
        ) as any[];
        return rows.map((row: any) => this.mapTenant(row));
      },

      findUnique: async (args: { where: { id?: string; slug?: string } }) => {
        const key = args.where.id ? 'id' : 'slug';
        const val = args.where.id || args.where.slug;
        const rows = await this.client.$queryRawUnsafe(
          `SELECT * FROM tenants WHERE ${key} = $1 LIMIT 1`, val
        ) as any[];
        return rows[0] ? this.mapTenant(rows[0]) : null;
      },

      findFirst: async () => {
        const rows = await this.client.$queryRawUnsafe(
          `SELECT * FROM tenants LIMIT 1`
        ) as any[];
        return rows[0] ? this.mapTenant(rows[0]) : null;
      },

      create: async (args: { data: any }) => {
        const d = args.data;
        const resolvedDbName = d.dbName || (d.slug ? `vivi_${String(d.slug).replace(/-/g, "_")}` : null);
        const rows = await this.client.$queryRawUnsafe(
          `INSERT INTO tenants (id, name, slug, status, db_name, admin_email, admin_name, plan, trial_expires_at, custom_domain, settings, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3::"TenantStatus", $4, $5, $6, $7::"TenantPlan", $8, $9, $10, NOW(), NOW())
           RETURNING *`,
          d.name, d.slug, d.status || 'PROVISIONING', resolvedDbName, d.adminEmail, d.adminName,
          d.plan || 'FREE_TRIAL', d.trialExpiresAt || null, d.customDomain || null,
          d.settings ? JSON.stringify(d.settings) : null,
        ) as any[];
        return this.mapTenant(rows[0]);
      },

      update: async (args: { where: { id: string }; data: any }) => {
        const sets: string[] = [];
        const vals: any[] = [];
        let i = 1;
        for (const [k, v] of Object.entries(args.data)) {
          const col = this.camelToSnake(k);
          if (k === "status") {
            sets.push(`${col} = $${i}::"TenantStatus"`);
          } else if (k === "plan") {
            sets.push(`${col} = $${i}::"TenantPlan"`);
          } else {
            sets.push(`${col} = $${i}`);
          }
          vals.push(v);
          i++;
        }
        sets.push(`updated_at = NOW()`);
        vals.push(args.where.id);
        const rows = await this.client.$queryRawUnsafe(
          `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
          ...vals,
        ) as any[];
        return this.mapTenant(rows[0]);
      },

      delete: async (args: { where: { id: string } }) => {
        await this.client.$queryRawUnsafe(
          `DELETE FROM tenants WHERE id = $1`, args.where.id
        );
      },

      count: async (args?: { where?: any }) => {
        const rows = args?.where?.status
          ? await this.client.$queryRawUnsafe(
              `SELECT COUNT(*)::int as count FROM tenants WHERE status = $1::"TenantStatus"`,
              args.where.status,
            ) as any[]
          : await this.client.$queryRawUnsafe(
              `SELECT COUNT(*)::int as count FROM tenants`,
            ) as any[];
        return rows[0]?.count || 0;
      },
    };
  }

  // ── SuperAdmin operations ─────────────────────────────────

  get superAdmin() {
    return {
      findUnique: async (args: { where: { email?: string; id?: string } }) => {
        const key = args.where.email ? 'email' : 'id';
        const val = args.where.email || args.where.id;
        const rows = await this.client.$queryRawUnsafe(
          `SELECT * FROM super_admins WHERE ${key} = $1 LIMIT 1`, val
        ) as any[];
        return rows[0] ? this.mapSuperAdmin(rows[0]) : null;
      },

      findFirst: async () => {
        const rows = await this.client.$queryRawUnsafe(
          `SELECT * FROM super_admins LIMIT 1`
        ) as any[];
        return rows[0] ? this.mapSuperAdmin(rows[0]) : null;
      },

      create: async (args: { data: any }) => {
        const d = args.data;
        const rows = await this.client.$queryRawUnsafe(
          `INSERT INTO super_admins (id, email, password_hash, name, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
           RETURNING *`,
          d.email, d.passwordHash, d.name,
        ) as any[];
        return this.mapSuperAdmin(rows[0]);
      },
    };
  }

  // ── Helpers ────────────────────────────────────────────────

  private mapTenant(row: any) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      dbName: row.db_name,
      adminEmail: row.admin_email,
      adminName: row.admin_name,
      plan: row.plan,
      trialExpiresAt: row.trial_expires_at,
      customDomain: row.custom_domain,
      settings: row.settings,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSuperAdmin(row: any) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name,
      createdAt: row.created_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  }
}

@Global()
@Module({
  providers: [ControlPlanePrismaService],
  exports: [ControlPlanePrismaService],
})
export class ControlPlaneModule {}
