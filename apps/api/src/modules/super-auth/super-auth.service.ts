import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

import { ControlPlanePrismaService } from "../../config/control-plane.module";

@Injectable()
export class SuperAuthService {
  constructor(
    private readonly controlDb: ControlPlanePrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.controlDb.superAdmin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      type: "super_admin",
    };

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: "8h" }),
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  /** Seed helper — creates the initial super admin if none exists */
  async seedSuperAdmin(email: string, password: string, name: string) {
    const exists = await this.controlDb.superAdmin.findFirst();
    if (exists) return exists;

    const hash = await bcrypt.hash(password, 12);
    return this.controlDb.superAdmin.create({
      data: { email, passwordHash: hash, name },
    });
  }
}
