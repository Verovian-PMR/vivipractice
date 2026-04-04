import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { SuperAuthService } from "./super-auth.service";
import { SuperAuthController } from "./super-auth.controller";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "8h" },
      }),
    }),
  ],
  controllers: [SuperAuthController],
  providers: [SuperAuthService],
  exports: [SuperAuthService, JwtModule],
})
export class SuperAuthModule {}
