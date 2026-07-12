export const canManageProfile = (session, userId) =>
  Boolean(session?.user?._id && userId && session.user._id === userId);

export const formatJoinedDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toDateString();
};
