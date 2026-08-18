export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Member portal configuration
  appsScriptUrl: process.env.MSAP_APPS_SCRIPT_URL ?? "",
  portalBaseUrl: process.env.PORTAL_BASE_URL ?? "",
  // Password setup token expiry (in milliseconds, default 24 hours)
  passwordSetupTokenExpiryMs: parseInt(process.env.PASSWORD_SETUP_TOKEN_EXPIRY_MS ?? "86400000", 10),
};
