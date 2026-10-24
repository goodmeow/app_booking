// A user may hold a current badge and one spare. Lost cards stay as records but
// no longer count towards the limit, matching the server rule.
export const CARD_ACTIVE_LIMIT = 2;

export const userCards = (user) => (Array.isArray(user?.cards) ? user.cards : []);

export const activeCards = (user) => userCards(user).filter((card) => card.status === "active");

export const activeCardCount = (user) => activeCards(user).length;

export const cardLimitReached = (user) => activeCardCount(user) >= CARD_ACTIVE_LIMIT;

// The card number used by the "master card" flag. Older payloads still carry the
// flat card_number field, so it stays as a fallback during the migration.
export const primaryCardNumber = (user) => activeCards(user)[0]?.card_number
  || String(user?.card_number ?? "").trim();
