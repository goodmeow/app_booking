import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getApiError } from "../domain/api-error.js";
import {
  MIN_DIRECTORY_QUERY_LENGTH,
  directoryQuery,
} from "../domain/users/attendee-directory.js";
import { useListUserQuery } from "../redux/services/users.js";

// Long enough to skip most keystrokes, short enough to feel responsive.
const SEARCH_DEBOUNCE_MS = 300;

// Single-employee picker for on-behalf bookings. The directory only answers a
// search of at least two characters, so typing is debounced and the query stays
// idle until the term is long enough.
const OnBehalfPicker = ({ value = null, disabled = false, onChange }) => {
  const { t } = useTranslation(["calendar", "common"]);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const term = directoryQuery(inputValue);
    if (term.length < MIN_DIRECTORY_QUERY_LENGTH) {
      setSearchTerm("");
      return undefined;
    }
    const timer = setTimeout(() => setSearchTerm(term), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const searchQuery = useListUserQuery({ q: searchTerm }, { skip: !searchTerm });
  const options = useMemo(
    () => (Array.isArray(searchQuery.data) ? searchQuery.data : []),
    [searchQuery.data]
  );

  const typedTerm = directoryQuery(inputValue);
  const needsMoreCharacters = typedTerm.length < MIN_DIRECTORY_QUERY_LENGTH;
  const searching = !needsMoreCharacters && (searchQuery.isFetching || !searchTerm);
  const noOptionsText = needsMoreCharacters
    ? t("editor.onBehalfSearchHint")
    : t("editor.onBehalfNoOptions");
  const helperText = searchQuery.isError
    ? getApiError(searchQuery.error, t("calendar.usersLoadError"))
    : t("editor.onBehalfHelp");

  return (
    <Autocomplete
      options={options}
      value={value}
      inputValue={inputValue}
      onChange={(_, selected) => onChange?.(selected || null)}
      onInputChange={(_, nextValue, reason) => setInputValue(reason === "reset" ? "" : nextValue)}
      // The server already narrowed the result list, so no local filtering.
      filterOptions={(available) => available}
      getOptionLabel={(option) => option?.name || option?.email || ""}
      isOptionEqualToValue={(option, selected) => option?._id === selected?._id}
      loading={searching}
      loadingText={t("editor.onBehalfSearching")}
      noOptionsText={noOptionsText}
      disabled={disabled}
      renderOption={(props, option) => (
        <Box component="li" {...props} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <Typography variant="body2" noWrap>{option.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{option.email}</Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t("editor.onBehalfLabel")}
          helperText={helperText}
          error={searchQuery.isError}
        />
      )}
    />
  );
};

export default OnBehalfPicker;
