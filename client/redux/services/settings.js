import { api } from "../api.js";

const queryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  const result = params.toString();
  return result ? `?${result}` : "";
};

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query({ query: () => "settings", providesTags: ["settings"] }),
    updateSettings: builder.mutation({ query: (body) => ({ url: "settings", method: "PUT", body }), invalidatesTags: ["settings"] }),
    getCardMaster: builder.query({ query: (filters) => `settings/card-master${queryString(filters)}`, providesTags: ["cards"] }),
    storeCardMaster: builder.mutation({ query: (body) => ({ url: "settings/card-master", method: "POST", body }), invalidatesTags: ["cards"] }),
    updateCardMaster: builder.mutation({ query: ({ _id, ...body }) => ({ url: `settings/card-master/${_id}`, method: "PUT", body }), invalidatesTags: ["cards"] }),
    deleteCardMaster: builder.mutation({ query: (id) => ({ url: `settings/card-master/${id}`, method: "DELETE" }), invalidatesTags: ["cards"] }),
  }),
});

export const { useGetSettingsQuery, useUpdateSettingsMutation, useGetCardMasterQuery, useStoreCardMasterMutation, useUpdateCardMasterMutation, useDeleteCardMasterMutation } = settingsApi;
