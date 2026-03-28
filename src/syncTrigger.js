import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * After a full memory rewrite, optionally run a repo/OpenClaw hook.
 * Set MEMORY_SYNC_COMMAND e.g. to `bash scripts/sync-memory.sh` on the VPS.
 */
export async function triggerMemorySync() {
  const cmd = process.env.MEMORY_SYNC_COMMAND?.trim();
  if (!cmd) return;

  try {
    await execAsync(cmd, {
      cwd: process.cwd(),
      timeout: 120_000,
      env: { ...process.env }
    });
  } catch (err) {
    console.error("MEMORY_SYNC_COMMAND failed:", err);
  }
}
