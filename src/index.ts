/**
 * @llanesleonardo/saas-platform
 * Reusable multi-tenant SaaS chassis (product-agnostic).
 */
export const PLATFORM_PACKAGE_NAME = "@llanesleonardo/saas-platform";
export const PLATFORM_PACKAGE_VERSION = "0.3.0";

export * from "./contracts";
export * from "./config";
export * from "./core";
export type { PlatformDatabaseAdapter } from "./db/port";
export { createMemoryPlatformAdapter } from "./db/memory";
