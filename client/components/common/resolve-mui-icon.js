export const resolveMuiIcon = (candidate) => {
  let resolved = candidate;
  while (resolved?.default && resolved.default !== resolved) resolved = resolved.default;
  return resolved;
};
