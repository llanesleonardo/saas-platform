/**
 * In-repo smoke for 0.2.0 chassis (no FormBuilder).
 */
import {
  PLATFORM_PACKAGE_VERSION,
  setPlatformConfig,
  getPlatformConfig,
  registerApiKeyScopes,
  registerFeatures,
  registerQuotas,
  registerJobHandler,
  evaluateFeature,
  evaluateQuota,
  getQuotaLimit,
  createMemoryPlatformAdapter,
} from "./index";
import { drainOutbox, requireWorkspaceMembership, slugifyWorkspaceName } from "./server";

async function main() {
  console.log(`saas-platform smoke ${PLATFORM_PACKAGE_VERSION}`);

  setPlatformConfig({ productName: "SmokeCRM", apiKeyPrefix: "smk_" });
  if (getPlatformConfig().apiKeyPrefix !== "smk_") throw new Error("config");

  registerApiKeyScopes(["contacts:read"]);
  registerFeatures(["pipelines"]);
  registerQuotas(["max_contacts"]);

  const plan = {
    id: "pro",
    features: { pipelines: true },
    quotas: { max_contacts: 100 },
  };
  if (!evaluateFeature(plan, "pipelines")) throw new Error("feature");
  if (!evaluateQuota(getQuotaLimit(plan, "max_contacts"), 50)) throw new Error("quota");

  const db = createMemoryPlatformAdapter();
  const user = await db.createUser({
    email: "a@example.com",
    password_hash: "x",
  });
  const ws = await db.createWorkspace({
    name: "Acme",
    slug: slugifyWorkspaceName("Acme"),
    owner_user_id: user.id,
  });
  await requireWorkspaceMembership(db, user.id, ws.id, "owner");

  let handled = false;
  registerJobHandler("crm_ping", async () => {
    handled = true;
  });
  await db.enqueueJob({
    type: "crm_ping",
    payload: {},
    workspace_id: ws.id,
  });
  const n = await drainOutbox(db, 5);
  if (n !== 1 || !handled) throw new Error("worker");

  console.log("PASS saas-platform smoke");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
