import { api } from "../api.js";
import { withQuery } from "../query-string.js";
import { buildAddAttendeePayload } from "../../domain/events/event-contract.js";

export const eventsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getEvents: builder.query({ query: (filters) => withQuery("events", filters), providesTags: ["events"] }),
    getEventDetails: builder.query({ query: (id) => `events/details?event_id=${encodeURIComponent(id)}`, providesTags: ["events"] }),
    storeEvent: builder.mutation({ query: (body) => ({ url: "events", method: "POST", body }), invalidatesTags: ["events"] }),
    updateEvent: builder.mutation({ query: (body) => ({ url: "events", method: "PUT", body }), invalidatesTags: ["events"] }),
    addEventAttendee: builder.mutation({ query: (attendee) => ({ url: "events/attendee", method: "POST", body: buildAddAttendeePayload(attendee) }), invalidatesTags: ["events"] }),
    deleteEventAttendee: builder.mutation({ query: ({ eventDetailId }) => ({ url: withQuery("events/details", { event_detail_id: eventDetailId }), method: "DELETE" }), invalidatesTags: ["events"] }),
    deleteEventById: builder.mutation({ query: ({ eventId }) => ({ url: withQuery("events/delete", { event_id: eventId }), method: "PUT" }), invalidatesTags: ["events"] }),
    deleteEvents: builder.mutation({ query: () => ({ url: "events", method: "DELETE", body: {} }), invalidatesTags: ["events"] }),
  }),
});

export const { useGetEventsQuery, useGetEventDetailsQuery, useStoreEventMutation, useUpdateEventMutation, useAddEventAttendeeMutation, useDeleteEventAttendeeMutation, useDeleteEventByIdMutation, useDeleteEventsMutation } = eventsApi;
