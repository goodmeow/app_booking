import { api } from "../api.js";
import { directoryUrl } from "../../domain/users/attendee-directory.js";

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // An argument adds the directory search (`?q=`); no argument keeps the
    // plain list that the admin management screen relies on.
    listUser: builder.query({ query: (argument) => directoryUrl(argument), providesTags: ["users"] }),
    detailUser: builder.query({ query: (id) => `users/${id}`, providesTags: ["users"] }),
    createUser: builder.mutation({ query: (body) => ({ url: "users/", method: "POST", body }), invalidatesTags: ["users"] }),
    importUsers: builder.mutation({ query: (body) => ({ url: "users/import", method: "POST", body }), invalidatesTags: ["users"] }),
    updateUser: builder.mutation({ query: ({ userId, ...body }) => ({ url: `users/${userId}`, method: "PUT", body }), invalidatesTags: ["users"] }),
    changePassword: builder.mutation({ query: (body) => ({ url: "users/change-password", method: "PUT", body }) }),
    deleteUser: builder.mutation({ query: (id) => ({ url: `users/${id}`, method: "DELETE" }), invalidatesTags: ["users"] }),
    // Cards are never deleted: a lost card keeps its record so the history
    // survives and a replacement can be issued with a new number.
    addUserCard: builder.mutation({
      query: ({ userId, card_number }) => ({ url: `users/${userId}/cards`, method: "POST", body: { card_number } }),
      invalidatesTags: ["users"],
    }),
    markUserCardLost: builder.mutation({
      query: ({ userId, cardId }) => ({ url: `users/${userId}/cards/${cardId}`, method: "PATCH", body: { status: "lost" } }),
      invalidatesTags: ["users"],
    }),
    reactivateUserCard: builder.mutation({
      query: ({ userId, cardId }) => ({ url: `users/${userId}/cards/${cardId}`, method: "PATCH", body: { status: "active" } }),
      invalidatesTags: ["users"],
    }),
  }),
});

export const {
  useListUserQuery,
  useDetailUserQuery,
  useCreateUserMutation,
  useImportUsersMutation,
  useUpdateUserMutation,
  useChangePasswordMutation,
  useDeleteUserMutation,
  useAddUserCardMutation,
  useMarkUserCardLostMutation,
  useReactivateUserCardMutation,
} = usersApi;
