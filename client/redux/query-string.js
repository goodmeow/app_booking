export const queryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  return params.toString();
};

export const withQuery = (path, query) => {
  const result = queryString(query);
  return result ? `${path}?${result}` : path;
};
