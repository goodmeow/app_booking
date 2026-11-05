export const BRAND_FALLBACKS = {
  mark: "/the-prasada-mark.png",
  wordmark: "/the-prasada-wordmark.png",
  favicon: "/the-prasada-mark.png",
};

export const brandAsset = (branding, kind) => branding?.assets?.[kind] || BRAND_FALLBACKS[kind] || "";

// A custom icon plus logo already spell the brand out, so the navbar text is
// only shown while that pair is incomplete.
export const brandShowsName = (branding) => !(branding?.assets?.mark && branding?.assets?.wordmark);
