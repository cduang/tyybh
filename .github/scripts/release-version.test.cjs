const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

function run(env, args = [], verify = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "ctyun-release-"));
  try {
    mkdirSync(join(dir, "ElectronApp"));
    const pkg = join(dir, "ElectronApp/package.json");
    const output = join(dir, "outputs.txt");
    writeFileSync(pkg, JSON.stringify({ name: "fixture", version: "1.3.0" }));
    const result = spawnSync(process.execPath, [join(__dirname, "release-version.cjs"), ...args], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "",
        GITHUB_REF: "",
        INPUT_TAG: "",
        RELEASE_TAG: "",
        ...env,
        GITHUB_OUTPUT: output,
      },
    });
    verify(result, () => readFileSync(output, "utf8"), () => JSON.parse(readFileSync(pkg, "utf8")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("tag push takes its version from the Git tag", () => {
  run({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/tags/v2.4.6", INPUT_TAG: "v9.0.0" }, [], (result, output) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(output(), "tag=v2.4.6\nversion=2.4.6\n");
  });
});

test("manual dispatch uses the supplied release tag", () => {
  run({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", INPUT_TAG: "v1.3.1" }, [], (result, output) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(output(), "tag=v1.3.1\nversion=1.3.1\n");
  });
});

test("manual input takes precedence when dispatching from an existing tag", () => {
  run({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/tags/v1.3.0", INPUT_TAG: "v1.3.1" }, [], (result, output) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(output(), "tag=v1.3.1\nversion=1.3.1\n");
  });
});

test("main push remains a UserScript-only publish", () => {
  run({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" }, [], (result, output, pkg) => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(output(), "tag=\nversion=\n");
    assert.equal(pkg().version, "1.3.0");
  });
});

test("Electron package version is synchronized before the build", () => {
  run({ RELEASE_TAG: "v2.4.6" }, ["--sync-electron"], (result, output, pkg) => {
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(pkg(), { name: "fixture", version: "2.4.6" });
    assert.equal(output(), "tag=v2.4.6\nversion=2.4.6\n");
  });
});

test("missing or malformed release tags fail before package modification", () => {
  for (const tag of ["", "1.3.1", "v01.3.1", "v1.3", "v1.3.1\nversion=9.9.9", "v1.3.1/other"]) {
    run({ RELEASE_TAG: tag }, ["--sync-electron"], (result, output, pkg) => {
      assert.notEqual(result.status, 0, tag);
      assert.equal(pkg().version, "1.3.0");
    });
  }
  run({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main" }, [], result => {
    assert.notEqual(result.status, 0);
  });
});
