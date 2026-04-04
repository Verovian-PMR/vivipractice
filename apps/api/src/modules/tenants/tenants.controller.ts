import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";

import { TenantsService } from "./tenants.service";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { Public } from "../../common/decorators/public.decorator";

@ApiTags("Tenants")
@ApiBearerAuth()
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get()
  @ApiOperation({ summary: "List all tenants" })
  findAll(@Query("status") status?: string) {
    return this.tenantsService.findAll(status);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get("stats")
  @ApiOperation({ summary: "Get tenant statistics" })
  getStats() {
    return this.tenantsService.getStats();
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get(":id")
  @ApiOperation({ summary: "Get tenant by ID" })
  findOne(@Param("id") id: string) {
    return this.tenantsService.findOne(id);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post()
  @ApiOperation({ summary: "Provision a new tenant" })
  provision(
    @Body()
    dto: {
      name: string;
      slug: string;
      adminEmail: string;
      adminName: string;
      plan?: string;
    },
  ) {
    return this.tenantsService.provision(dto);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Patch(":id")
  @ApiOperation({ summary: "Update tenant (status, plan, settings)" })
  update(
    @Param("id") id: string,
    @Body() dto: { status?: string; plan?: string; settings?: any; name?: string },
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post(":id/reset-admin")
  @ApiOperation({ summary: "Reset tenant admin password to {slug}1234" })
  resetAdmin(@Param("id") id: string) {
    return this.tenantsService.resetAdminPassword(id);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Delete(":id")
  @ApiOperation({ summary: "Decommission tenant (drops DB)" })
  decommission(@Param("id") id: string) {
    return this.tenantsService.decommission(id);
  }
}
