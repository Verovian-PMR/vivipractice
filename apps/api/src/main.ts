import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { json, urlencoded } from "express";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
    bodyParser: false, // disable default to override size limit
  });

  // Increase JSON body size limit — services data includes base64 images
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Security headers — relax cross-origin policies in dev so CORS works
  app.use(
    helmet({
      crossOriginResourcePolicy:
        process.env.NODE_ENV === "production"
          ? { policy: "same-origin" }
          : { policy: "cross-origin" },
    })
  );

  // CORS - restrict in production
  app.enableCors({
    origin:
      process.env.NODE_ENV === "production"
        ? (origin, callback) => {
            if (!origin) {
              callback(null, true);
              return;
            }

            const envAllowed = [
              process.env.DASHBOARD_URL,
              process.env.PUBLIC_SITE_URL,
              process.env.CONTROL_HUB_URL,
            ].filter(Boolean) as string[];

            if (
              envAllowed.includes(origin) ||
              /^https:\/\/([a-z0-9-]+\.)?vivipractice\.com$/i.test(origin)
            ) {
              callback(null, true);
              return;
            }

            callback(new Error("Not allowed by CORS"));
          }
        : true,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix("api/v1");

  // Validation pipe - whitelist strips unknown properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // Swagger docs (dev only)
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("VivIPractice API")
      .setDescription("PharmaConnect Platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`VivIPractice API running on port ${port}`);
}
bootstrap();
