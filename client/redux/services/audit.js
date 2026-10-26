import { api } from "../api.js";

export const auditApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAuditLog: builder.query({
      query: (limit = 100) => `audit?limit=${limit}`,
      providesTags: ["audit"],
    }),
  }),
});

export const { useGetAuditLogQuery } = auditApi;
