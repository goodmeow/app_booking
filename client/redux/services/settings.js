import { api } from "../api.js";
import { withQuery } from "../query-string.js";

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query({ query: () => "settings", providesTags: ["settings"] }),
    getPublicSettings: builder.query({ query: () => "settings/public", providesTags: ["settings"] }),
    getBranding: builder.query({ query: () => "branding", providesTags: ["branding"] }),
    updateBranding: builder.mutation({ query: (body) => ({ url: "branding", method: "PUT", body }), invalidatesTags: ["branding"] }),
    uploadBrandAsset: builder.mutation({ query: ({ kind, dataUrl }) => ({ url: `branding/${kind}`, method: "PUT", body: { data_url: dataUrl } }), invalidatesTags: ["branding"] }),
    deleteBrandAsset: builder.mutation({ query: (kind) => ({ url: `branding/${kind}`, method: "DELETE" }), invalidatesTags: ["branding"] }),
    updateSettings: builder.mutation({ query: (body) => ({ url: "settings", method: "PUT", body }), invalidatesTags: ["settings"] }),
    runBackup: builder.mutation({ query: () => ({ url: "settings/backup/run", method: "POST" }), invalidatesTags: ["settings"] }),
    getCardMaster: builder.query({ query: (filters) => withQuery("settings/card-master", filters), providesTags: ["cards"] }),
    storeCardMaster: builder.mutation({ query: (body) => ({ url: "settings/card-master", method: "POST", body }), invalidatesTags: ["cards"] }),
    updateCardMaster: builder.mutation({ query: (body) => ({ url: `settings/card-master/${body._id}`, method: "PUT", body }), invalidatesTags: ["cards"] }),
    deleteCardMaster: builder.mutation({ query: (id) => ({ url: `settings/card-master/${id}`, method: "DELETE" }), invalidatesTags: ["cards"] }),
  }),
});

export const {
  useGetSettingsQuery,
  useGetPublicSettingsQuery,
  useUpdateSettingsMutation,
  useRunBackupMutation,
  useGetBrandingQuery,
  useUpdateBrandingMutation,
  useUploadBrandAssetMutation,
  useDeleteBrandAssetMutation,
  useGetCardMasterQuery,
  useStoreCardMasterMutation,
  useUpdateCardMasterMutation,
  useDeleteCardMasterMutation,
} = settingsApi;
