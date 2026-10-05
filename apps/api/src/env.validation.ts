import * as Joi from 'joi';

// Fails fast at boot with one clear message listing every problem, instead
// of the app starting successfully and then throwing a confusing
// `undefined` deep inside a service the first time a request touches it.
// Split into two groups: vars the app cannot run without, and vars that
// gate an optional feature (AI, billing, rendering) — those stay optional
// here because the corresponding service already degrades gracefully with
// them unset (see ai-provider.factory.ts, billing.service.ts).
export const envValidationSchema = Joi.object({
  // Not constrained to the standard development/production/test enum —
  // this environment's shell sets NODE_ENV to a custom value (Next.js
  // warns about it too), and the only place this app reads it is the
  // `secure` cookie flag check (`=== 'production'`), so any string is fine.
  NODE_ENV: Joi.string().default('development'),
  PORT: Joi.number().default(3001),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required(),

  WEB_ORIGIN: Joi.string().uri().required(),
  PUBLIC_API_URL: Joi.string().uri().required(),

  STORAGE_ROOT: Joi.string().required(),
  UPLOAD_SIGNING_SECRET: Joi.string().min(16).required(),

  // Optional — feature-gated, not app-fatal when unset.
  CHROME_EXECUTABLE_PATH: Joi.string().optional(),
  ANTHROPIC_API_KEY: Joi.string().optional(),
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_PRO_PRICE_ID: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
}).unknown(true); // leave unrelated env vars (PATH, HOME, ...) alone
