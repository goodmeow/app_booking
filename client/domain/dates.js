const pad = (value) => String(value).padStart(2, "0");

export const currentMonthRange = (now = new Date()) => ({
  start: new Date(now.getFullYear(), now.getMonth(), 1),
  end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
});

export const formatDateDDMMYYYY = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

export const reportFilename = (start, end) =>
  `History Meeting Report (${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}).xlsx`;
