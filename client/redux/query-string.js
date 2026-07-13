export const queryString = (query = {}) => {
  const parts = [];
  const append = (key, value) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${key}[${index}]`, item));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([childKey, item]) => append(`${key}[${childKey}]`, item));
      return;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  Object.entries(query).forEach(([key, value]) => append(key, value));
  return parts.join("&");
};

export const withQuery = (path, query) => {
  const result = queryString(query);
  return result ? `${path}?${result}` : path;
};
