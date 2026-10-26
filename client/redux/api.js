import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { isAuthenticated } from "../auth/auth-helper.js";

export const api = createApi({
  reducerPath: "api",
  refetchOnMountOrArgChange: true,
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/",
    prepareHeaders: (headers) => {
      const session = isAuthenticated();
      if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);
      return headers;
    },
  }),
  tagTypes: ["events", "users", "rooms", "settings", "cards", "kioskDevices", "setupStatus", "access", "audit"],
  endpoints: () => ({}),
});
