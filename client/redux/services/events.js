import { api } from "../api.js";

const queryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  const result = params.toString();
  return result ? `?${result}` : "";
};

export const eventsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getEvents: builder.query({ query: (filters) => `events${queryString(filters)}`, providesTags: ["events"] }),
    getEventDetails: builder.query({ query: (id) => `events/details?event_id=${encodeURIComponent(id)}`, providesTags: ["events"] }),
    storeEvent: builder.mutation({ query: (body) => ({ url: "events", method: "POST", body }), invalidatesTags: ["events"] }),
    updateEvent: builder.mutation({ query: (body) => ({ url: "events", method: "PUT", body }), invalidatesTags: ["events"] }),
    deleteEventAttendee: builder.mutation({ query: (rawQuery) => ({ url: `events/details?${rawQuery}`, method: "DELETE" }), invalidatesTags: ["events"] }),
    deleteEventById: builder.mutation({ query: (rawQuery) => ({ url: `events/delete?${rawQuery}`, method: "PUT" }), invalidatesTags: ["events"] }),
    deleteEvents: builder.mutation({ query: () => ({ url: "events", method: "DELETE", body: {} }), invalidatesTags: ["events"] }),
  }),
});

export const { useGetEventsQuery, useGetEventDetailsQuery, useStoreEventMutation, useUpdateEventMutation, useDeleteEventAttendeeMutation, useDeleteEventByIdMutation, useDeleteEventsMutation } = eventsApi;
