import { api } from "../api.js";

const queryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  const result = params.toString();
  return result ? `?${result}` : "";
};

export const roomsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRooms: builder.query({ query: (filters) => `rooms${queryString(filters)}`, providesTags: ["rooms"] }),
    getRoomById: builder.query({ query: (id) => `rooms/${id}`, providesTags: ["rooms"] }),
    storeRoom: builder.mutation({ query: (body) => ({ url: "rooms/", method: "POST", body }), invalidatesTags: ["rooms"] }),
    updateRoom: builder.mutation({ query: ({ userId, ...body }) => ({ url: `rooms/${userId}`, method: "PUT", body }), invalidatesTags: ["rooms"] }),
    deleteRoomById: builder.mutation({ query: (id) => ({ url: `rooms/${id}`, method: "DELETE", body: {} }), invalidatesTags: ["rooms"] }),
    getRoomUsage: builder.query({ query: ({ start, end }) => `rooms/usage-report${queryString({ start, end })}` }),
  }),
});

export const { useGetRoomsQuery, useGetRoomByIdQuery, useStoreRoomMutation, useUpdateRoomMutation, useDeleteRoomByIdMutation, useGetRoomUsageQuery } = roomsApi;
