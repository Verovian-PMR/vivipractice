import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

import { SuperAuthService } from "./super-auth.service";
import { Public } from "../../common/decorators/public.decorator";

@ApiTags("Super Admin Auth")
@Controller("super")
export class SuperAuthController {
  constructor(private readonly superAuthService: SuperAuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Super admin login" })
  login(@Body() dto: { email: string; password: string }) {
    return this.superAuthService.login(dto.email, dto.password);
  }

  @Public()
  @Post("seed")
  @ApiOperation({ summary: "Seed initial super admin (dev only)" })
  seed(@Body() dto: { email: string; password: string; name: string }) {
    if (process.env.NODE_ENV === "production") {
      return { error: "Not available in production" };
    }
    return this.superAuthService.seedSuperAdmin(dto.email, dto.password, dto.name);
  }
}
