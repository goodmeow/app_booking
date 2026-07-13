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
  }),
});

export const { useGetKioskDevicesQuery, useRevokeKioskDeviceMutation } = kioskDevicesApi;
