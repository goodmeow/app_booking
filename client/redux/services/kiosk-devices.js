import { api } from "../api.js";
import { withQuery } from "../query-string.js";

export const kioskDevicesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getKioskDevices: builder.query({
      query: (roomId) => withQuery("kiosk/devices", { roomId }),
      providesTags: ["kioskDevices"],
    }),
    revokeKioskDevice: builder.mutation({
      query: (deviceId) => ({
        url: `kiosk/devices/${encodeURIComponent(deviceId)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["kioskDevices"],
    }),
    updateKioskDeviceCapabilities: builder.mutation({
      query: ({ deviceId, ...capabilities }) => ({
        url: `kiosk/devices/${encodeURIComponent(deviceId)}/capabilities`,
        method: "PATCH",
        body: capabilities,
      }),
      invalidatesTags: ["kioskDevices"],
    }),
  }),
});

export const {
  useGetKioskDevicesQuery,
  useRevokeKioskDeviceMutation,
  useUpdateKioskDeviceCapabilitiesMutation,
} = kioskDevicesApi;
