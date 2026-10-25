import { formatDateDDMMMYYYY } from "./dates.js";

export const canManageProfile = (session, userId) =>
  Boolean(session?.user?._id && userId && session.user._id === userId);

export const formatJoinedDate = (value, language) => {
  try {
    return formatDateDDMMMYYYY(value, language);
  } catch {
    return "-";
  }
};
