const pad = (value) => String(value).padStart(2, "0");
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const currentMonthRange = (now = new Date()) => ({
  start: new Date(now.getFullYear(), now.getMonth(), 1),
  end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
});

export const formatDateDDMMYYYY = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

export const formatDateYYYYMMDD = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatDateLong = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${pad(date.getDate())} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatDateTimeLong = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${formatDateLong(date)}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const isValidDateRange = (start, end) => {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  return !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && startDate <= endDate;
};

export const reportFilename = (start, end) =>
  `History Meeting Report (${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}).xlsx`;
