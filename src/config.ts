/**
 * Product-agnostic runtime config. Set once at app boot.
 */

export interface PlatformConfig {
  /** Display / audit product name (e.g. "PeopleForms", "AcmeCRM"). */
  productName: string;
  /** API key plaintext prefix (e.g. "pf_", "acme_"). */
  apiKeyPrefix: string;
  supportEmail?: string;
  /** Cookie name for active workspace; optional until ./next helpers exist. */
  workspaceCookieName?: string;
}

const DEFAULTS: PlatformConfig = {
  productName: "SaaS",
  apiKeyPrefix: "key_",
};

let config: PlatformConfig = { ...DEFAULTS };

export function setPlatformConfig(next: Partial<PlatformConfig> & Pick<PlatformConfig, "productName" | "apiKeyPrefix">): void {
  config = {
    ...config,
    ...next,
    productName: next.productName.trim() || DEFAULTS.productName,
    apiKeyPrefix: next.apiKeyPrefix.trim() || DEFAULTS.apiKeyPrefix,
  };
}

export function getPlatformConfig(): Readonly<PlatformConfig> {
  return config;
}

export function resetPlatformConfigForTests(): void {
  config = { ...DEFAULTS };
}
