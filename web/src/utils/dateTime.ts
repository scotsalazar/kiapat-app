import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TIMEZONE = 'Asia/Manila';
const DEFAULT_DATE_TIME_FORMAT = 'MMM D, YYYY h:mm A';
const DEFAULT_DATE_FORMAT = 'MMM D, YYYY';

type InputDate = string | number | Date | null | undefined;

const getDayjsInstance = (value: InputDate) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const instance = dayjs(value);
  if (!instance.isValid()) {
    return null;
  }
  return instance.tz(DEFAULT_TIMEZONE);
};

export const formatDateTime = (
  value: InputDate,
  format: string = DEFAULT_DATE_TIME_FORMAT,
): string => {
  const instance = getDayjsInstance(value);
  if (!instance) {
    return '';
  }
  return instance.format(format);
};

export const formatDate = (value: InputDate, format: string = DEFAULT_DATE_FORMAT): string => {
  const instance = getDayjsInstance(value);
  if (!instance) {
    return '';
  }
  return instance.format(format);
};

export const getTimezoneLabel = (): string => DEFAULT_TIMEZONE;

