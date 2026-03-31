import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const queues = new Map();

/**
 * Serialize async work per logical key inside this Node process.
 * This prevents lost updates across concurrent requests touching the same file/user state.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withKeyedLock(key, fn) {
  const prev = queues.get(key) ?? Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  queues.set(key, gate);
  await prev.catch(() => {});

  try {
    return await fn();
  } finally {
    release();
    if (queues.get(key) === gate) {
      queues.delete(key);
    }
  }
}

/**
 * Write via a unique temp file + rename.
 * @param {string} filePath
 * @param {string} content
 */
export async function atomicWriteFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, filePath);
}
