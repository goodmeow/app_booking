import { api } from "../api.js";

export const accessApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMyMenus: builder.query({ query: () => "access/menus", providesTags: ["access"] }),
    getMenuMatrix: builder.query({ query: () => "access/matrix", providesTags: ["access"] }),
    updateMenuMatrix: builder.mutation({
      query: (access) => ({ url: "access/matrix", method: "PUT", body: { access } }),
      invalidatesTags: ["access"],
    }),
  }),
});

export const { useGetMyMenusQuery, useGetMenuMatrixQuery, useUpdateMenuMatrixMutation } = accessApi;
