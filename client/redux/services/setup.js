import { api } from "../api.js";

// Both endpoints are public: they exist for the first-admin installation and
// are only reachable while the server still reports setup as required.
export const setupApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSetupStatus: builder.query({
      query: () => "setup/status",
      providesTags: ["setupStatus"],
    }),
    submitSetup: builder.mutation({
      query: (body) => ({ url: "setup", method: "POST", body }),
      invalidatesTags: ["setupStatus"],
    }),
  }),
});

export const { useGetSetupStatusQuery, useSubmitSetupMutation } = setupApi;
