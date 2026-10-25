import { publicBranding, readBrandAsset, removeBrandAsset, saveBranding, uploadBrandAsset } from "./branding.service.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const read = run(async (req, res) => res.json(await publicBranding()));
export const save = run(async (req, res) => res.json(await saveBranding(req.body)));
export const asset = run(async (req, res) => {
  const file = await readBrandAsset(req.params.kind);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.type(file.mime).send(file.bytes);
});
export const upload = run(async (req, res) => {
  const result = await uploadBrandAsset(req.params.kind, req.body);
  req.io?.emit("response:branding", { type: "branding:changed" });
  res.json(result);
});
export const remove = run(async (req, res) => {
  const result = await removeBrandAsset(req.params.kind);
  req.io?.emit("response:branding", { type: "branding:changed" });
  res.json(result);
});
