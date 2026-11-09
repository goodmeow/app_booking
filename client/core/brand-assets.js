export const BRAND_FALLBACKS = {
  mark: "/the-prasada-mark.png",
  wordmark: "/the-prasada-wordmark.png",
  favicon: "/the-prasada-mark.png",
};

export const brandAsset = (branding, kind) => branding?.assets?.[kind] || BRAND_FALLBACKS[kind] || "";

export const brandHasAssets = (branding) => Boolean(branding?.assets?.mark || branding?.assets?.wordmark);

export const brandHasLockup = (branding) => Boolean(branding?.assets?.mark && branding?.assets?.wordmark);

// A custom icon plus logo already spell the brand out, so the navbar text is
// only shown while that pair is incomplete.
export const brandShowsName = (branding) => !brandHasLockup(branding);

// The sign-in card sits on a white/very dark surface, so it needs the version
// of the lockup that stays readable: colour on light, white on dark.
export const signinLogoSource = (mode) => (mode === "dark" ? "/the-prasada-logo.png" : "/the-prasada-logo-colour.png");

// Without a custom favicon, a letter tile keeps the tab recognisable without
// shipping another image. The wordmark is an image, so the letter comes from
// the brand name text.
export const initialFaviconSource = (brandName) => {
  const match = String(brandName || "")
    .trim()
    .match(/[a-z0-9]/i);
  const letter = match ? match[0].toUpperCase() : "R";
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="14" fill="#2A3439"/>' +
    `<text x="32" y="45" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-size="38" font-weight="700" fill="#E6A817">${letter}</text>` +
    "</svg>";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
