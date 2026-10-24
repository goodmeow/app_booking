// The directory API answers a short search term with an error instead of an
// empty result, so the client must wait for at least two characters.
export const MIN_DIRECTORY_QUERY_LENGTH = 2;

const trimmed = (value) => String(value ?? "").trim();

// listUser accepts either a plain search string or an argument object `{ q }`.
export const directoryQuery = (argument) => {
  if (argument && typeof argument === "object") return trimmed(argument.q);
  return trimmed(argument);
};

// Without a search term the server decides the scope: the whole list for an
// admin, the floor roster for everyone else.
export const directoryUrl = (argument) => {
  const q = directoryQuery(argument);
  return q ? `users/?q=${encodeURIComponent(q)}` : "users/";
};

export const userIndexByEmail = (users) => {
  const index = new Map();
  for (const user of Array.isArray(users) ? users : []) {
    const email = trimmed(user?.email).toLowerCase();
    if (!email) continue;
    index.set(email, user);
  }
  return index;
};

// Keep users seen in earlier searches so an attendee that is already selected
// still resolves to its user id after the result list moves to another query.
export const mergeUserIndex = (current, users) => {
  let merged = current;
  for (const user of Array.isArray(users) ? users : []) {
    const email = trimmed(user?.email).toLowerCase();
    if (!email) continue;
    const existing = merged.get(email);
    if (existing && existing._id === user._id && existing.name === user.name) continue;
    if (merged === current) merged = new Map(current);
    merged.set(email, user);
  }
  return merged;
};

// Autocomplete options are the e-mail strings so selected chips keep showing
// addresses; names are looked up from the same index while rendering.
export const directoryEmails = (users) => [...userIndexByEmail(users).values()]
  .map((user) => trimmed(user.email));
