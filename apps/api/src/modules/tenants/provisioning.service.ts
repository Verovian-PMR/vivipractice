import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { execSync } from "child_process";
import * as path from "path";

/**
 * Handles the heavy lifting of tenant provisioning:
 * - Creating a PostgreSQL database
 * - Running Prisma schema push against it
 * - Seeding default data (pages, settings, admin user)
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  /** Base Postgres connection URL (without specific database) */
  private get baseUrl(): string {
    const url = process.env.DATABASE_URL || "";
    // Replace the database name portion with template1 for admin commands
    return url.replace(/\/[^/?]+(\?|$)/, "/template1$1");
  }

  /** Build a connection URL for a specific database */
  private dbUrl(dbName: string): string {
    const url = process.env.DATABASE_URL || "";
    return url.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
  }

  /** Create a new PostgreSQL database for the tenant */
  async createDatabase(dbName: string): Promise<void> {
    this.logger.log(`Creating database: ${dbName}`);
    const adminClient = new PrismaClient({
      datasourceUrl: this.baseUrl,
    });
    try {
      await adminClient.$executeRawUnsafe(
        `CREATE DATABASE "${dbName}"`
      );
      this.logger.log(`Database ${dbName} created successfully`);
    } finally {
      await adminClient.$disconnect();
    }
  }

  /** Run Prisma schema push against the tenant database */
  async pushSchema(dbName: string): Promise<void> {
    this.logger.log(`Pushing data-plane schema to ${dbName}`);
    const schemaPath = path.resolve(
      process.cwd(),
      "packages/database/prisma/schema.prisma",
    );
    const url = this.dbUrl(dbName);

    // Use prisma db push with the tenant's database URL
    execSync(
      `npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
      {
        env: { ...process.env, DATABASE_URL: url },
        stdio: "pipe",
        timeout: 30000,
      },
    );
    this.logger.log(`Schema pushed to ${dbName}`);
  }

  /** Seed default pages, site settings, and brand settings */
  async seedDefaults(dbName: string): Promise<void> {
    this.logger.log(`Seeding defaults for ${dbName}`);
    const client = new PrismaClient({ datasourceUrl: this.dbUrl(dbName) });

    try {
      // Site settings (brand, header, footer)
      await client.siteSettings.upsert({
        where: { id: "site_settings" },
        update: {},
        create: {
          id: "site_settings",
          settingsJson: {
            brand: {
              logoUrl: "",
              faviconUrl: "",
              fontFamily: "Asap",
              primaryColor: "#0F52BA",
              secondaryColor: "#1E88E5",
              accentColor: "#E65100",
            },
            header: {
              bgColor: "#FFFFFF",
              navFontColor: "#0F52BA",
              headerStyle: "classic",
            },
            footer: {
              bgColor: "#0F52BA",
              useCustomBg: false,
              textColor: "#FFFFFF",
              privacyUrl: "",
              termsUrl: "",
            },
          },
        },
      });

      // Default pages
      const defaultPages = [
        { id: "pg-home", title: "Home", slug: "/", isVisible: true, isDefault: true, isServices: false, isBooking: false, order: 0 },
        { id: "pg-about", title: "About Us", slug: "/about", isVisible: true, isDefault: true, isServices: false, isBooking: false, order: 1 },
        { id: "pg-services", title: "Services", slug: "/services", isVisible: true, isDefault: true, isServices: true, isBooking: false, order: 2 },
        { id: "pg-contact", title: "Contact", slug: "/contact", isVisible: true, isDefault: true, isServices: false, isBooking: false, order: 3 },
        { id: "pg-booking", title: "Booking", slug: "/booking", isVisible: true, isDefault: true, isServices: false, isBooking: true, order: 4 },
      ];

      for (const page of defaultPages) {
        await client.page.upsert({
          where: { id: page.id },
          update: {},
          create: page,
        });
      }

      // Home page slider component
      await client.pageComponent.upsert({
        where: { id: "ci-1" },
        update: {},
        create: {
          id: "ci-1",
          pageId: "pg-home",
          defId: "home-slider",
          type: "HOME_SLIDER",
          config: {
            selectedServiceIds: [],
            layout: "centered",
            sliderLayout: "full-bleed",
            overlayColor: "rgba(0,0,0,0.45)",
            textColor: "#FFFFFF",
            buttonText: "Book Now",
            borderRadius: "0",
            padding: "128",
          },
          order: 0,
        },
      });

      this.logger.log(`Defaults seeded for ${dbName}`);
    } finally {
      await client.$disconnect();
    }
  }

  /** Create the initial admin user for the tenant */
  async createAdminUser(
    dbName: string,
    email: string,
    name: string,
    slug: string,
  ): Promise<void> {
    this.logger.log(`Creating admin user for ${dbName}`);
    const client = new PrismaClient({ datasourceUrl: this.dbUrl(dbName) });

    try {
      // Password convention: {slug}1234
      const password = `${slug}1234`;
      const hash = await bcrypt.hash(password, 12);

      await client.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: hash,
          name,
          role: "PHARMACY_ADMIN",
        },
      });

      this.logger.log(`Admin user created: ${email} (password: ${slug}1234)`);
    } finally {
      await client.$disconnect();
    }
  }

  /** Reset a tenant admin password back to {slug}1234 */
  async resetAdminPassword(dbName: string, slug: string): Promise<void> {
    const client = new PrismaClient({ datasourceUrl: this.dbUrl(dbName) });

    try {
      const password = `${slug}1234`;
      const hash = await bcrypt.hash(password, 12);

      // Find the first PHARMACY_ADMIN user and reset
      const admin = await client.user.findFirst({
        where: { role: "PHARMACY_ADMIN" },
      });

      if (admin) {
        await client.user.update({
          where: { id: admin.id },
          data: { passwordHash: hash },
        });
      }
    } finally {
      await client.$disconnect();
    }
  }

  /** Drop the tenant database entirely */
  async dropDatabase(dbName: string): Promise<void> {
    this.logger.warn(`Dropping database: ${dbName}`);
    const adminClient = new PrismaClient({
      datasourceUrl: this.baseUrl,
    });
    try {
      // Terminate existing connections
      await adminClient.$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`,
      );
      await adminClient.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
      this.logger.warn(`Database ${dbName} dropped`);
    } finally {
      await adminClient.$disconnect();
    }
  }
}
