export const BRAND_FALLBACKS = {
  mark: "/the-prasada-mark.png",
  wordmark: "/the-prasada-wordmark.png",
  favicon: "/the-prasada-mark.png",
};

export const brandAsset = (branding, kind) =>
  branding?.assets?.[kind] || BRAND_FALLBACKS[kind] || "";
