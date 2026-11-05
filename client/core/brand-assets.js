export const BRAND_FALLBACKS = {
  mark: "/the-prasada-mark.png",
  wordmark: "/the-prasada-wordmark.png",
  favicon: "/the-prasada-mark.png",
};

export const brandAsset = (branding, kind) => branding?.assets?.[kind] || BRAND_FALLBACKS[kind] || "";

export const brandHasLockup = (branding) => Boolean(branding?.assets?.mark && branding?.assets?.wordmark);

// A custom icon plus logo already spell the brand out, so the navbar text is
// only shown while that pair is incomplete.
export const brandShowsName = (branding) => !brandHasLockup(branding);

// The sign-in card sits on a white/very dark surface, so it needs the version
// of the lockup that stays readable: colour on light, white on dark.
export const signinLogoSource = (mode) => (mode === "dark" ? "/the-prasada-logo.png" : "/the-prasada-logo-colour.png");
