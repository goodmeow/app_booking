export const getApiError = (error, fallback = "Request failed") =>
  error?.data?.error || error?.error || error?.message || fallback;
