import React, { useEffect, useMemo, useState } from "react";
import { Select, Spin, Typography } from "antd";
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
  // Keep the selected employee in the option list: the search result moves on
  // as soon as the input text changes, and the value must stay resolvable.
  const options = useMemo(() => {
    const found = Array.isArray(searchQuery.data) ? searchQuery.data : [];
    const people = !value || found.some((option) => option?._id === value?._id)
      ? found
      : [value, ...found];
    return people.map((person) => ({
      value: person._id,
      label: person.name || person.email,
      person,
    }));
  }, [searchQuery.data, value]);

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
    <div>
      <Typography.Text strong>{t("editor.onBehalfLabel")}</Typography.Text>
      <Select
        showSearch
        allowClear
        value={value?._id}
        options={options}
        onSearch={setInputValue}
        filterOption={false}
        loading={searching}
        disabled={disabled}
        status={searchQuery.isError ? "error" : undefined}
        notFoundContent={searching ? <Spin size="small" /> : noOptionsText}
        onChange={(id) => {
          const selected = options.find((option) => option.value === id);
          onChange?.(selected?.person || null);
        }}
        optionRender={(option) => (
          <div>
            <div>{option.data.person?.name}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {option.data.person?.email}
            </Typography.Text>
          </div>
        )}
        style={{ width: "100%" }}
      />
      <Typography.Text type={searchQuery.isError ? "danger" : "secondary"}>
        {helperText}
      </Typography.Text>
    </div>
  );
};

export default OnBehalfPicker;
