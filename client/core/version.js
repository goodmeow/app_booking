// Satu sumber versi untuk CMS: package.json dibaca saat build, jadi naikkan
// version di sana pada penutupan gelombang (docs/VERSIONING.md) dan label di
// drawer menyesuaikan sendiri.
import packageJson from "../../package.json";

export const CMS_VERSION = packageJson.version;
