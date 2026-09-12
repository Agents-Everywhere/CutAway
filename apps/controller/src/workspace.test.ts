import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  allowedEdit,
  buildTarget,
  changedSource,
  copySource,
  sourceDigest,
} from "./workspace.js";

test("worker-supplied dependencies cannot replace the installed target libraries", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "cutaway-dependencies-"));
  try {
    await mkdir(join(scratch, "node_modules"));
    await assert.rejects(
      buildTarget(scratch, process.cwd()),
      /installed dependencies/,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("worker edits are limited to client and booking logic", () => {
  assert.equal(allowedEdit("src/server/reservations.ts"), true);
  assert.equal(allowedEdit("src/server/booking-transaction.ts"), true);
  assert.equal(allowedEdit("src/client/main.tsx"), true);
  for (const path of [
    "src/server/database.ts",
    "src/server/index.ts",
    "src/client/connector.ts",
    "package.json",
    ".env",
  ]) {
    assert.equal(allowedEdit(path), false, path);
  }
});

test("candidate hashes bind file content and protected changes are rejected", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "cutaway-workspace-"));
  try {
    const base = join(scratch, "base");
    const candidate = join(scratch, "candidate");
    await mkdir(join(base, "src/server"), { recursive: true });
    await writeFile(
      join(base, "src/server/reservations.ts"),
      "export const version = 1;\n",
    );
    await writeFile(join(base, "package.json"), '{"private":true}\n');
    await copySource(base, candidate);
    assert.equal(await sourceDigest(base), await sourceDigest(candidate));
    await writeFile(
      join(candidate, "src/server/reservations.ts"),
      "export const version = 2;\n",
    );
    assert.notEqual(await sourceDigest(base), await sourceDigest(candidate));
    assert.deepEqual(await changedSource(base, candidate), [
      "src/server/reservations.ts",
    ]);
    await writeFile(join(candidate, "package.json"), "{}\n");
    await assert.rejects(changedSource(base, candidate), /protected source/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("candidate source cannot traverse a filesystem symlink", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "cutaway-symlink-"));
  try {
    await symlink("/etc/passwd", join(scratch, "unexpected.ts"));
    await assert.rejects(sourceDigest(scratch), /Symlinks are not allowed/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("a worker output symlink is rejected before Vite can erase its destination", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "cutaway-output-link-"));
  try {
    const candidate = join(scratch, "candidate");
    const outside = join(scratch, "outside");
    await mkdir(candidate);
    await mkdir(outside);
    await writeFile(join(outside, "keep.txt"), "must survive");
    await symlink(outside, join(candidate, "dist"));
    await assert.rejects(
      buildTarget(candidate, process.cwd()),
      /Symlinks are not allowed/,
    );
    assert.equal(
      await readFile(join(outside, "keep.txt"), "utf8"),
      "must survive",
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
