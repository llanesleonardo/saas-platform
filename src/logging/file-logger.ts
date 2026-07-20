import fs from "fs";
import path from "path";
import { redactMeta } from "../security/redact";

/**
 * File-based backend logger with optional JSON stdout for SaaS drains.
 * Server-only — never import from client components.
 */

export type LogLevel = "INFO" | "WARN" | "ERROR";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), "logsfiles");
const FILE_PREFIX = "app-";
const FILE_EXT = ".log";

let currentFilePath: string | null = null;
let currentIndex = 0;

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function fileNameForIndex(index: number): string {
  return `${FILE_PREFIX}${String(index).padStart(4, "0")}${FILE_EXT}`;
}

function findLatestIndex(): number {
  ensureLogDir();
  const pattern = new RegExp(`^${FILE_PREFIX}(\\d{4})\\${FILE_EXT}$`);
  let latest = 1;
  for (const entry of fs.readdirSync(LOG_DIR)) {
    const match = pattern.exec(entry);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (idx > latest) latest = idx;
    }
  }
  return latest;
}

function resolveActiveFile(): string {
  if (currentIndex === 0) {
    currentIndex = findLatestIndex();
    currentFilePath = path.join(LOG_DIR, fileNameForIndex(currentIndex));
  }

  if (currentFilePath && fs.existsSync(currentFilePath)) {
    const { size } = fs.statSync(currentFilePath);
    if (size >= MAX_FILE_SIZE_BYTES) {
      currentIndex += 1;
      currentFilePath = path.join(LOG_DIR, fileNameForIndex(currentIndex));
    }
  }

  return currentFilePath ?? path.join(LOG_DIR, fileNameForIndex(currentIndex));
}

function formatLine(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const safe = redactMeta(meta);
  const metaPart = safe && Object.keys(safe).length > 0 ? ` ${JSON.stringify(safe)}` : "";
  return `[${timestamp}] [${level}] [${context}] ${message}${metaPart}\n`;
}

export function logToFile(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  try {
    ensureLogDir();
    const filePath = resolveActiveFile();
    fs.appendFileSync(filePath, formatLine(level, context, message, meta), "utf8");
  } catch (err) {
    console.error("[file-logger] failed to write log line:", err);
  }

  if (
    process.env.LOG_STDOUT === "1" ||
    (process.env.DEPLOYMENT_MODE ?? "").toLowerCase() === "saas"
  ) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      context,
      message,
      ...(redactMeta(meta) ?? {}),
    };
    if (level === "ERROR") console.error(JSON.stringify(payload));
    else if (level === "WARN") console.warn(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  }
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>): void {
  logToFile("INFO", context, message, meta);
}

export function logWarn(context: string, message: string, meta?: Record<string, unknown>): void {
  logToFile("WARN", context, message, meta);
}

export function logErrorToFile(
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  logToFile("ERROR", context, message, meta);
}
