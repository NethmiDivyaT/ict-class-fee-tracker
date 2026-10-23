import { pathToFileURL } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const core = await import(
  pathToFileURL(path.resolve("packages/core/src/index.ts")).href
);

const before = await core.getStorageInfo();
console.log(
  JSON.stringify(
    {
      mode: before.mode,
      path: before.path || null,
      counts: before.counts,
    },
    null,
    2,
  ),
);

if (before.mode === "local" && before.path) {
  const expected = path.resolve("apps/api/data/fees.db");
  if (path.resolve(before.path) !== expected) {
    throw new Error(`Local DB path is ${before.path}, expected ${expected}`);
  }
}

const name = `__storage_probe_${Date.now()}__`;
const created = await core.createClass({
  name,
  monthly_fee: 0,
  students: [],
});
if (!created.ok || !created.id) {
  throw new Error(created.error || "Probe insert failed.");
}

const fromCore = await core.sqlGet(
  "SELECT id, name FROM classes WHERE id = ?",
  [created.id],
);
if (!fromCore || fromCore.name !== name) {
  throw new Error("Write did not persist through the app database layer.");
}

if (before.mode === "local" && before.path) {
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
  const disk = new DatabaseSync(before.path, { readOnly: true });
  const fromDisk = disk
    .prepare("SELECT name FROM classes WHERE id = ?")
    .get(created.id);
  disk.close();
  if (!fromDisk || fromDisk.name !== name) {
    throw new Error("Write did not land in apps/api/data/fees.db.");
  }
}

await core.deleteClass(created.id);
const gone = await core.sqlGet("SELECT id FROM classes WHERE id = ?", [
  created.id,
]);
if (gone) throw new Error("Probe cleanup failed.");

console.log("storage-ok");
