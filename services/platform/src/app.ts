import { DomainError } from "@obscurus/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { isProduction } from "./runtime.ts";
import { authRoutes } from "./routes/auth.ts";
import { brandingRoutes } from "./routes/branding.ts";
import { logoRoutes } from "./routes/logos.ts";
import { curlRoutes } from "./routes/curl.ts";
import { endpointRoutes } from "./routes/endpoints.ts";
import { invocationRoutes } from "./routes/invocations.ts";
import { invokeRoutes } from "./routes/invoke.ts";
import { payRoutes } from "./routes/pay.ts";
import { paymentRoutes } from "./routes/payments.ts";
import { projectRoutes } from "./routes/projects.ts";
import { secretRoutes } from "./routes/secrets.ts";

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

  app.onError((err, c) => {
    if (err instanceof DomainError) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.status as 400 | 401 | 403 | 404 | 409,
      );
    }
    console.error(
      JSON.stringify({
        level: "error",
        error_class: err.name,
        ...(isProduction(c.env) ? {} : { message: err.message }),
      }),
    );
    const message = isProduction(c.env) ? "Internal error" : err.message;
    return c.json({ error: { code: "internal", message } }, 500);
  });

  app.use("/v1/pay/*", cors());
  app.use("/v1/invoke", cors());
  app.use("/v1/logos/*", cors());

  app.route("/v1/auth", authRoutes);
  app.route("/v1/curl", curlRoutes);
  app.route("/v1/projects", projectRoutes);
  app.route("/v1/endpoints", endpointRoutes);
  app.route("/v1/secrets", secretRoutes);
  app.route("/v1/invocations", invocationRoutes);
  app.route("/v1/payments", paymentRoutes);
  app.route("/v1/pay", payRoutes);
  app.route("/v1/invoke", invokeRoutes);
  app.route("/v1/branding", brandingRoutes);
  app.route("/v1/logos", logoRoutes);
  return app;
}
