import express, { type Express, type ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { registerRoutes, requireHubAuth } from "./routes/routes";
import { logger } from "./lib/logger";
import { allowWorkspaceWrite } from "./lib/ai-usage";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// The standalone Motion artifact shares the protected Hub API. Canonicalize
// its prefixed URL before both the same-origin guard and Clerk middleware so
// the exact same authorization and ownership rules apply to both entry points.
app.use((req, _res, next) => {
  const prefix = "/ai-hub-motion";
  const hubPath = `${prefix}/api/hub`;
  if (req.path === hubPath || req.path.startsWith(`${hubPath}/`)) {
    req.url = req.url.slice(prefix.length);
  }
  next();
});

// Every API alias is private, including Signal Room's formerly public routes.
// Never allow shared/browser caches to retain another account's responses.
app.use((req, res, next) => {
  if (!req.path.toLowerCase().startsWith("/api/")) return next();
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.vary("Cookie");
  res.vary("Authorization");

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.get("sec-fetch-site") === "cross-site") {
      return res.status(403).json({ message: "Cross-origin requests are not allowed" });
    }
    const origin = req.get("origin");
    let originHost: string | undefined;
    try {
      if (origin) originHost = new URL(origin).host;
    } catch {
      return res.status(403).json({ message: "Invalid request origin" });
    }
    const requestHosts = [req.get("host"), req.get("x-forwarded-host")?.split(",")[0]?.trim()];
    if (!originHost || !requestHosts.includes(originHost)) {
      return res.status(403).json({ message: "Cross-origin requests are not allowed" });
    }
  }
  return next();
});
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);
app.use("/api", requireHubAuth);
app.use("/api", async (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (await allowWorkspaceWrite(req, res)) return next();
});
app.use("/api/hub", router);
registerRoutes(app, "/api");
registerRoutes(app, "/api/hub");

const apiErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === "entity.too.large") {
    res.status(413).json({ message: "Request body is too large. The maximum is 64 KB." });
  } else if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ message: "Invalid JSON request body." });
  } else {
    req.log.error({ errorType: error?.name || "Error" }, "API request failed");
    res.status(500).json({ message: "The request could not be completed." });
  }
};
app.use(apiErrorHandler);

export default app;
