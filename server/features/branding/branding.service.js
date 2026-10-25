import { badRequest, notFound } from "../../lib/http-error.js";
import {
  deleteBrandAsset,
  getBrandAsset,
  getBrandingSettings,
  listBrandAssetVersions,
  updateBrandingSettings,
  upsertBrandAsset,
} from "./branding.repository.js";

export const BRAND_KINDS = new Set(["mark", "wordmark", "favicon"]);
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"]);
const MAX_BYTES = 512 * 1024;

const cleanText = (value, field, max) => {
  const text = String(value ?? "").trim();
  if (!text) throw badRequest("INVALID_BRANDING", `${field} is required`);
  if (text.length > max) throw badRequest("INVALID_BRANDING", `${field} is too long`);
  return text;
};

const assetUrl = (kind, version) => (version == null
  ? null
  : `/api/branding/${kind}?v=${version}`);

export const publicBranding = async () => {
  const [settings, versions] = await Promise.all([
    getBrandingSettings(),
    listBrandAssetVersions(),
  ]);
  const versionByKind = new Map(versions.map((row) => [row.kind, row.version]));
  const assets = {};
  for (const kind of BRAND_KINDS) {
    assets[kind] = assetUrl(kind, versionByKind.get(kind));
  }
  return {
    brand_name: settings?.brand_name || "RoomBooking",
    document_title: settings?.document_title || "RoomBooking — The Prasada",
    assets,
  };
};

export const saveBranding = async (body) => {
  const brandName = cleanText(body?.brand_name, "brand_name", 80);
  const documentTitle = cleanText(body?.document_title, "document_title", 120);
  await updateBrandingSettings({ brandName, documentTitle });
  return publicBranding();
};

export const readBrandAsset = async (kind) => {
  if (!BRAND_KINDS.has(kind)) throw notFound("Brand asset not found");
  const asset = await getBrandAsset(kind);
  if (!asset) throw notFound("Brand asset not found");
  return asset;
};

export const uploadBrandAsset = async (kind, body) => {
  if (!BRAND_KINDS.has(kind)) throw badRequest("INVALID_BRANDING", "Unknown brand asset");
  const dataUrl = String(body?.data_url || "");
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw badRequest("INVALID_BRANDING", "Upload a base64 image data URL");
  const mime = match[1].toLowerCase();
  if (!MIME_TYPES.has(mime)) {
    throw badRequest("INVALID_BRANDING", "Use PNG, JPEG, WebP, or ICO");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) {
    throw badRequest("INVALID_BRANDING", "Image must be 1 byte to 512 KB");
  }
  await upsertBrandAsset({ kind, mime, bytes });
  return publicBranding();
};

export const removeBrandAsset = async (kind) => {
  if (!BRAND_KINDS.has(kind)) throw badRequest("INVALID_BRANDING", "Unknown brand asset");
  await deleteBrandAsset(kind);
  return publicBranding();
};
