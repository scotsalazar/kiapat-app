import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TIMEZONE = 'Asia/Manila';
const DEFAULT_DATETIME_FORMAT = 'MMM D, YYYY h:mm A';
const DEFAULT_DATE_FORMAT = 'MMM D, YYYY';

export const formatDateTime = (
  value: string | number | Date | null | undefined,
  format = DEFAULT_DATETIME_FORMAT,
): string => {
  if (!value) {
    return '';
  }
  return dayjs(value).tz(DEFAULT_TIMEZONE).format(format);
};

export const formatDate = (
  value: string | number | Date | null | undefined,
  format = DEFAULT_DATE_FORMAT,
): string => {
  if (!value) {
    return '';
  }
  return dayjs(value).tz(DEFAULT_TIMEZONE).format(format);
};

export { DEFAULT_TIMEZONE };
