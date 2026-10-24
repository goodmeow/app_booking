import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import {
  MIN_DIRECTORY_QUERY_LENGTH,
  directoryEmails,
  directoryQuery,
  mergeUserIndex,
  userIndexByEmail,
} from "../domain/users/attendee-directory.js";
import { useListUserQuery } from "../redux/services/users.js";

// Long enough to skip most keystrokes, short enough to feel responsive.
const SEARCH_DEBOUNCE_MS = 300;

const AttendeePicker = ({
  isAdmin = false,
  users = [],
  attendees = [],
  value = [],
  disabled = false,
  onChange,
}) => {
  const { t } = useTranslation(["calendar", "common"]);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Admins keep the full management list; everyone else searches on demand so
  // the whole directory is never sent to a regular user.
  const adminQuery = useListUserQuery(undefined, { skip: !isAdmin });
  const searchQuery = useListUserQuery({ q: searchTerm }, { skip: isAdmin || !searchTerm });
  const activeQuery = isAdmin ? adminQuery : searchQuery;

  useEffect(() => {
    if (isAdmin) {
      setSearchTerm("");
      return undefined;
    }
    const term = directoryQuery(inputValue);
    if (term.length < MIN_DIRECTORY_QUERY_LENGTH) {
      setSearchTerm("");
      return undefined;
    }
    const timer = setTimeout(() => setSearchTerm(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, isAdmin]);

  const resultIndex = useMemo(() => userIndexByEmail(activeQuery.data), [activeQuery.data]);
  const [knownUsers, setKnownUsers] = useState(() => new Map());

  useEffect(() => {
    if (!resultIndex.size) return;
    setKnownUsers((current) => mergeUserIndex(current, [...resultIndex.values()]));
  }, [resultIndex]);

  // Selected attendees from an edited meeting already carry their user id;
  // remember them so toggling other chips does not drop it.
  const previousIndex = useMemo(
    () => userIndexByEmail(attendees
      .filter((attendee) => attendee?.attendee_user_id && attendee?.attendee_email)
      .map((attendee) => ({ _id: attendee.attendee_user_id, email: attendee.attendee_email }))),
    [attendees]
  );

  const knownIndex = useMemo(
    () => mergeUserIndex(userIndexByEmail(users), [...knownUsers.values()]),
    [users, knownUsers]
  );

  const options = useMemo(
    () => directoryEmails(isAdmin ? users : activeQuery.data),
    [isAdmin, users, activeQuery.data]
  );

  const typedTerm = directoryQuery(inputValue);
  const needsMoreCharacters = !isAdmin && typedTerm.length < MIN_DIRECTORY_QUERY_LENGTH;
  const searching = !isAdmin && !needsMoreCharacters && (activeQuery.isFetching || !searchTerm);
  const noOptionsText = needsMoreCharacters
    ? t("editor.attendeeSearchHint")
    : t("editor.attendeeNoOptions");
  const helperText = !isAdmin && searchQuery.isError
    ? getApiError(searchQuery.error, t("calendar.usersLoadError"))
    : (needsMoreCharacters ? t("editor.attendeeSearchHint") : undefined);

  const resolveAttendee = (email) => {
    const key = String(email ?? "").trim().toLowerCase();
    const user = knownIndex.get(key) || previousIndex.get(key);
    if (user?._id) return { attendee_email: user.email, attendee_user_id: user._id };
    return { attendee_email: String(email ?? "").trim() };
  };

  const changeInput = (_, nextValue, reason) => {
    // "reset" is MUI clearing the field after a chip was added.
    setInputValue(reason === "reset" ? "" : nextValue);
  };

  const changeSelection = (_, values) => {
    onChange?.((Array.isArray(values) ? values : []).map((item) => resolveAttendee(item)));
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      options={options}
      value={value}
      inputValue={inputValue}
      onChange={changeSelection}
      onInputChange={changeInput}
      // Search results are already narrowed by the server; admin options are
      // filtered locally as before.
      filterOptions={isAdmin ? undefined : (available) => available}
      getOptionLabel={(option) => (typeof option === "string" ? option : option?.email || "")}
      loading={searching}
      loadingText={t("editor.attendeeSearching")}
      noOptionsText={noOptionsText}
      disabled={disabled}
      renderOption={(props, option) => {
        const user = knownIndex.get(String(option).toLowerCase());
        return (
          <Box component="li" {...props} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <Typography variant="body2" noWrap>{user?.name || option}</Typography>
            {user?.name ? <Typography variant="caption" color="text.secondary" noWrap>{option}</Typography> : null}
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("editor.attendees")}
          error={!isAdmin && searchQuery.isError}
          helperText={helperText}
        />
      )}
    />
  );
};

export default AttendeePicker;
