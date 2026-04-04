import { Module } from "@nestjs/common";

import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";
import { ProvisioningService } from "./provisioning.service";
import { SuperAuthModule } from "../super-auth/super-auth.module";

@Module({
  imports: [SuperAuthModule],
  controllers: [TenantsController],
  providers: [TenantsService, ProvisioningService],
  exports: [TenantsService],
})
export class TenantsModule {}
