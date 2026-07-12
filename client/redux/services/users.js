import { api } from "../api.js";

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listUser: builder.query({ query: () => "users/", providesTags: ["users"] }),
    detailUser: builder.query({ query: (id) => `users/${id}`, providesTags: ["users"] }),
    createUser: builder.mutation({ query: (body) => ({ url: "users/", method: "POST", body }), invalidatesTags: ["users"] }),
    updateUser: builder.mutation({ query: ({ userId, ...body }) => ({ url: `users/${userId}`, method: "PUT", body }), invalidatesTags: ["users"] }),
    changePassword: builder.mutation({ query: (body) => ({ url: "users/change-password", method: "PUT", body }) }),
    deleteUser: builder.mutation({ query: (id) => ({ url: `users/${id}`, method: "DELETE" }), invalidatesTags: ["users"] }),
  }),
});

export const { useListUserQuery, useDetailUserQuery, useCreateUserMutation, useUpdateUserMutation, useChangePasswordMutation, useDeleteUserMutation } = usersApi;
