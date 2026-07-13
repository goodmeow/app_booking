import { api } from "../api.js";
import { withQuery } from "../query-string.js";

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query({ query: () => "settings", providesTags: ["settings"] }),
    updateSettings: builder.mutation({ query: (body) => ({ url: "settings", method: "PUT", body }), invalidatesTags: ["settings"] }),
    getCardMaster: builder.query({ query: (filters) => withQuery("settings/card-master", filters), providesTags: ["cards"] }),
    storeCardMaster: builder.mutation({ query: (body) => ({ url: "settings/card-master", method: "POST", body }), invalidatesTags: ["cards"] }),
    updateCardMaster: builder.mutation({ query: (body) => ({ url: `settings/card-master/${body._id}`, method: "PUT", body }), invalidatesTags: ["cards"] }),
    deleteCardMaster: builder.mutation({ query: (id) => ({ url: `settings/card-master/${id}`, method: "DELETE" }), invalidatesTags: ["cards"] }),
  }),
});

export const { useGetSettingsQuery, useUpdateSettingsMutation, useGetCardMasterQuery, useStoreCardMasterMutation, useUpdateCardMasterMutation, useDeleteCardMasterMutation } = settingsApi;
