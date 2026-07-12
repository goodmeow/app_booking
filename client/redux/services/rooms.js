import { api } from "../api.js";
import { withQuery } from "../query-string.js";

export const roomsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRooms: builder.query({ query: (filters) => withQuery("rooms", filters), providesTags: ["rooms"] }),
    getAvailableRooms: builder.query({ query: ({ start_dates, end_dates, rooms } = {}) => withQuery("rooms/available", { start_dates, end_dates, rooms }), providesTags: ["rooms"] }),
    getRoomById: builder.query({ query: (id) => `rooms/${id}`, providesTags: ["rooms"] }),
    storeRoom: builder.mutation({ query: (body) => ({ url: "rooms/", method: "POST", body }), invalidatesTags: ["rooms"] }),
    updateRoom: builder.mutation({ query: ({ roomId, ...body }) => ({ url: `rooms/${roomId}`, method: "PUT", body }), invalidatesTags: ["rooms"] }),
    deleteRoomById: builder.mutation({ query: (id) => ({ url: `rooms/${id}`, method: "DELETE", body: {} }), invalidatesTags: ["rooms"] }),
    getRoomUsage: builder.query({ query: ({ start, end }) => withQuery("rooms/usage-report", { start, end }) }),
  }),
});

export const { useGetRoomsQuery, useGetAvailableRoomsQuery, useGetRoomByIdQuery, useStoreRoomMutation, useUpdateRoomMutation, useDeleteRoomByIdMutation, useGetRoomUsageQuery } = roomsApi;
