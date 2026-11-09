import { api } from "../api.js";
import { withQuery } from "../query-string.js";

export const faceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFaceStatus: builder.query({
      query: () => "face/status",
      providesTags: ["face"],
    }),
    getFaceTemplates: builder.query({
      query: (params) => withQuery("face/templates", params),
      providesTags: ["face"],
    }),
    getFaceVerifyLog: builder.query({
      query: (params) => withQuery("face/verify-log", params),
      providesTags: ["face"],
    }),
  }),
});

export const { useGetFaceStatusQuery, useGetFaceTemplatesQuery, useGetFaceVerifyLogQuery } = faceApi;
