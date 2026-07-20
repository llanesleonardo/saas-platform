export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

import fs from "fs";
import path from "path";

function isSaasMode(): boolean {
  return (process.env.DEPLOYMENT_MODE ?? "").trim().toLowerCase() === "saas";
}

function localStorage(): ObjectStorage {
  const root = path.join(process.cwd(), "public");
  return {
    async put(key, body) {
      const full = path.join(root, key);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, body);
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
      return { url: `${base}/${key.replace(/\\/g, "/")}` };
    },
    async delete(key) {
      const full = path.join(root, key);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    },
  };
}

function containerForKey(key: string): string {
  if (key.startsWith("policies/") || key.includes("/policies/")) {
    return process.env.AZURE_STORAGE_CONTAINER_POLICIES ?? "policies";
  }
  return process.env.AZURE_STORAGE_CONTAINER_UPLOADS ?? "uploads";
}

function blobName(key: string): string {
  return key.replace(/^\/+/, "");
}

/**
 * Azure Blob via managed identity (DefaultAzureCredential).
 * Requires optional peers: @azure/storage-blob + @azure/identity.
 */
function azureBlobStorage(): ObjectStorage {
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME?.trim();
  const endpoint =
    process.env.AZURE_STORAGE_BLOB_ENDPOINT?.trim() ||
    (account ? `https://${account}.blob.core.windows.net` : "");

  if (!account || !endpoint) {
    if (isSaasMode() && process.env.NODE_ENV === "production") {
      throw new Error(
        "STORAGE_PROVIDER=azure requires AZURE_STORAGE_ACCOUNT_NAME (and optional AZURE_STORAGE_BLOB_ENDPOINT)",
      );
    }
    return localStorage();
  }

  return {
    async put(key, body, contentType) {
      const { BlobServiceClient } = await import("@azure/storage-blob");
      const { DefaultAzureCredential } = await import("@azure/identity");
      const credential = new DefaultAzureCredential({
        managedIdentityClientId: process.env.AZURE_CLIENT_ID || undefined,
      });
      const service = new BlobServiceClient(endpoint.replace(/\/$/, ""), credential);
      const container = service.getContainerClient(containerForKey(key));
      await container.createIfNotExists();
      const block = container.getBlockBlobClient(blobName(key));
      await block.uploadData(body, {
        blobHTTPHeaders: { blobContentType: contentType },
      });
      const publicBase = process.env.AZURE_STORAGE_PUBLIC_URL?.replace(/\/$/, "");
      const url = publicBase ? `${publicBase}/${blobName(key)}` : block.url;
      return { url };
    },
    async delete(key) {
      const { BlobServiceClient } = await import("@azure/storage-blob");
      const { DefaultAzureCredential } = await import("@azure/identity");
      const credential = new DefaultAzureCredential({
        managedIdentityClientId: process.env.AZURE_CLIENT_ID || undefined,
      });
      const service = new BlobServiceClient(endpoint.replace(/\/$/, ""), credential);
      const container = service.getContainerClient(containerForKey(key));
      await container.deleteBlob(blobName(key)).catch(() => undefined);
    },
  };
}

function s3Storage(): ObjectStorage {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicBase = process.env.S3_PUBLIC_URL;
  const region = process.env.S3_REGION ?? "auto";

  return {
    async put(key, body, contentType) {
      if (!endpoint || !bucket || !accessKey || !secretKey) {
        if (isSaasMode() && process.env.NODE_ENV === "production") {
          throw new Error("STORAGE_PROVIDER=s3 is incomplete in production");
        }
        return localStorage().put(key, body, contentType);
      }

      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true,
      });
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      const publicUrl = publicBase
        ? `${publicBase.replace(/\/$/, "")}/${key}`
        : `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
      return { url: publicUrl };
    },
    async delete(key) {
      if (!endpoint || !bucket || !accessKey || !secretKey) return;
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true,
      });
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    },
  };
}

export function getObjectStorage(): ObjectStorage {
  const provider = (process.env.STORAGE_PROVIDER ?? "").toLowerCase();
  if (provider === "azure") {
    return azureBlobStorage();
  }
  if (provider === "s3" || (isSaasMode() && provider !== "local" && provider !== "")) {
    if (provider === "" && isSaasMode()) {
      if (process.env.AZURE_STORAGE_ACCOUNT_NAME) {
        return azureBlobStorage();
      }
      if (process.env.S3_ENDPOINT && process.env.S3_BUCKET) {
        return s3Storage();
      }
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "SaaS production requires STORAGE_PROVIDER=azure|s3 with durable object storage",
        );
      }
      return localStorage();
    }
    return s3Storage();
  }
  return localStorage();
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  return getObjectStorage().put(key, body, contentType);
}
