import React, { useMemo } from "react";
import {
  Alert,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { ErrorState, LoadingState } from "../components/common/AsyncState.js";
import { getApiError } from "../domain/api-error.js";
import { useGetRoomsQuery } from "../redux/services/rooms.js";
import { useListUserQuery } from "../redux/services/users.js";
import { floorGroupRows, missingFloorCount } from "./floor-groups.js";

// Read-only picture of the floor groups: rooms, employees, and receptionists per
// floor. Floor groups are edited on the Users/Rooms tabs, so this panel only
// reports and points there.
const FloorGroupsSection = () => {
  const { t } = useTranslation(["management", "common"]);
  const roomsQuery = useGetRoomsQuery();
  const usersQuery = useListUserQuery();
  const rows = useMemo(
    () => floorGroupRows({ rooms: roomsQuery.data, users: usersQuery.data }),
    [roomsQuery.data, usersQuery.data]
  );
  const missingFloor = useMemo(() => missingFloorCount(usersQuery.data), [usersQuery.data]);
  const loading = roomsQuery.isLoading || usersQuery.isLoading;

  return (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom>
        {t("settings.floorGroups.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("settings.floorGroups.description")}
      </Typography>
      {roomsQuery.isError ? (
        <ErrorState
          message={getApiError(roomsQuery.error, t("rooms.loadError"))}
          busy={roomsQuery.isFetching}
          onAction={() => roomsQuery.refetch()}
        />
      ) : null}
      {usersQuery.isError ? (
        <ErrorState
          message={getApiError(usersQuery.error, t("users.loadError"))}
          busy={usersQuery.isFetching}
          onAction={() => usersQuery.refetch()}
        />
      ) : null}
      {missingFloor > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("settings.floorGroups.missingFloor", { count: missingFloor })}
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {t("settings.floorGroups.manageHint")}
          </Typography>
        </Alert>
      ) : null}
      {loading ? <LoadingState label={t("settings.floorGroups.loading")} /> : null}
      {!loading && !rows.length ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>{t("settings.floorGroups.empty")}</Typography>
      ) : null}
      {!loading && rows.length ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("settings.floorGroups.floor")}</TableCell>
                <TableCell align="right">{t("settings.floorGroups.rooms")}</TableCell>
                <TableCell align="right">{t("settings.floorGroups.employees")}</TableCell>
                <TableCell>{t("settings.floorGroups.receptionists")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.floor} hover>
                  <TableCell>{row.floor}</TableCell>
                  <TableCell align="right">{row.roomCount}</TableCell>
                  <TableCell align="right">{row.employeeCount}</TableCell>
                  <TableCell>
                    {row.receptionists.length
                      ? row.receptionists.join(", ")
                      : t("settings.floorGroups.none")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  );
};

export default FloorGroupsSection;
