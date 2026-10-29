import React, { useEffect, useMemo, useState } from "react";
import { Select, Spin, Typography } from "antd";
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
import { useMenuAccess } from "../auth/use-menu-access.js";

// Long enough to skip most keystrokes, short enough to feel responsive.
const SEARCH_DEBOUNCE_MS = 300;

const AttendeePicker = ({
  users = [],
  attendees = [],
  value = [],
  disabled = false,
  onChange,
}) => {
  const { t } = useTranslation(["calendar", "common"]);
  const { can } = useMenuAccess();
  // The full management list is a Users-menu capability, not an admin-role
  // capability. An admin without that menu uses the search path instead.
  const canListAllUsers = can("users");
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Users-menu roles keep the full management list; everyone else searches on
  // demand so the whole directory is never sent to a regular user.
  const adminQuery = useListUserQuery(undefined, { skip: !canListAllUsers });
  const searchQuery = useListUserQuery({ q: searchTerm }, { skip: canListAllUsers || !searchTerm });
  const activeQuery = canListAllUsers ? adminQuery : searchQuery;

  useEffect(() => {
    if (canListAllUsers) {
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
  }, [inputValue, canListAllUsers]);

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
    () => directoryEmails(canListAllUsers ? users : activeQuery.data).map((email) => ({
      value: email,
      label: email,
    })),
    [canListAllUsers, users, activeQuery.data]
  );

  const typedTerm = directoryQuery(inputValue);
  const needsMoreCharacters = !canListAllUsers && typedTerm.length < MIN_DIRECTORY_QUERY_LENGTH;
  const searching = !canListAllUsers && !needsMoreCharacters && (activeQuery.isFetching || !searchTerm);
  const noOptionsText = needsMoreCharacters
    ? t("editor.attendeeSearchHint")
    : t("editor.attendeeNoOptions");
  const helperText = !canListAllUsers && searchQuery.isError
    ? getApiError(searchQuery.error, t("calendar.usersLoadError"))
    : (needsMoreCharacters ? t("editor.attendeeSearchHint") : undefined);

  const resolveAttendee = (email) => {
    const key = String(email ?? "").trim().toLowerCase();
    const user = knownIndex.get(key) || previousIndex.get(key);
    if (user?._id) return { attendee_email: user.email, attendee_user_id: user._id };
    return { attendee_email: String(email ?? "").trim() };
  };

  const changeSelection = (values) => {
    onChange?.((Array.isArray(values) ? values : []).map((item) => resolveAttendee(item)));
  };

  return (
    <div>
      <Typography.Text strong>{t("editor.attendees")}</Typography.Text>
      <Select
        mode="tags"
        value={value}
        options={options}
        onChange={changeSelection}
        onSearch={setInputValue}
        tokenSeparators={[",", ";"]}
        filterOption={canListAllUsers
          ? (input, option) => option.value.toLowerCase().includes(String(input).toLowerCase())
          : false}
        loading={searching}
        disabled={disabled}
        status={!canListAllUsers && searchQuery.isError ? "error" : undefined}
        notFoundContent={searching ? <Spin size="small" /> : noOptionsText}
        optionLabelProp="value"
        optionRender={(option) => {
          const user = knownIndex.get(String(option.value).toLowerCase());
          return (
            <div>
              <div>{user?.name || option.value}</div>
              {user?.name ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{option.value}</Typography.Text>
              ) : null}
            </div>
          );
        }}
        style={{ width: "100%" }}
      />
      {helperText ? (
        <Typography.Text type={!canListAllUsers && searchQuery.isError ? "danger" : "secondary"}>
          {helperText}
        </Typography.Text>
      ) : null}
    </div>
  );
};

export default AttendeePicker;
