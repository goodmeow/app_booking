// Single source of truth for the CMS version: package.json is read at build time,
// so bump the version there when closing a wave (docs/VERSIONING.md) and the drawer
// label follows automatically.
import packageJson from "../../package.json";

export const CMS_VERSION = packageJson.version;
