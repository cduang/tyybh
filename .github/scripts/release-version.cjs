const fs = require("node:fs");
const path = require("node:path");

const isRelease = process.env.GITHUB_EVENT_NAME === "workflow_dispatch" ||
  (process.env.GITHUB_EVENT_NAME === "push" && process.env.GITHUB_REF?.startsWith("refs/tags/"));
const tag = process.argv.includes("--sync-electron")
  ? process.env.RELEASE_TAG
  : process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
    ? process.env.INPUT_TAG
    : process.env.GITHUB_REF?.startsWith("refs/tags/")
      ? process.env.GITHUB_REF.slice("refs/tags/".length)
      : "";

if ((isRelease || process.argv.includes("--sync-electron")) && !tag) {
  throw new Error("Release tag is required (expected vX.Y.Z)");
}
// Keep the release tag, package version and Windows artifact version identical.
if (tag && !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
  throw new Error(`Invalid release tag: ${tag}. Expected vX.Y.Z (for example v1.3.1)`);
}
const version = tag ? tag.slice(1) : "";

if (process.argv.includes("--sync-electron")) {
  const packagePath = path.resolve("ElectronApp/package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  pkg.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Electron package and embedded app version: ${version}`);
}

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\nversion=${version}\n`);
}
console.log(tag ? `Release: ${tag}, artifact version: ${version}` : "UserScript-only publish; no Electron release");
