import { query } from "../../db/pool.js";

export const getBrandingSettings = async () => (await query(
  `SELECT id, brand_name, document_title, updated_at
   FROM tbl_branding_settings
   WHERE id = 1`
)).rows[0] || null;

export const updateBrandingSettings = async ({ brandName, documentTitle }) => (await query(
  `UPDATE tbl_branding_settings
   SET brand_name = $1,
       document_title = $2,
       updated_at = now()
   WHERE id = 1
   RETURNING id, brand_name, document_title, updated_at`,
  [brandName, documentTitle]
)).rows[0] || null;

export const getBrandAsset = async (kind) => (await query(
  `SELECT kind, mime, bytes, updated_at
   FROM tbl_brand_assets
   WHERE kind = $1`,
  [kind]
)).rows[0] || null;

export const listBrandAssetVersions = async () => (await query(
  `SELECT kind, floor(extract(epoch FROM updated_at) * 1000)::bigint AS version
   FROM tbl_brand_assets`
)).rows;

export const upsertBrandAsset = async ({ kind, mime, bytes }) => (await query(
  `INSERT INTO tbl_brand_assets (kind, mime, bytes, updated_at)
   VALUES ($1, $2, $3, now())
   ON CONFLICT (kind) DO UPDATE
     SET mime = EXCLUDED.mime,
         bytes = EXCLUDED.bytes,
         updated_at = now()
   RETURNING kind, mime, updated_at`,
  [kind, mime, bytes]
)).rows[0] || null;

export const deleteBrandAsset = async (kind) => (await query(
  `DELETE FROM tbl_brand_assets WHERE kind = $1 RETURNING kind`,
  [kind]
)).rows[0] || null;
