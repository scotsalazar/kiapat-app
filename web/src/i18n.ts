import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import fil from './locales/fil';

const resources = {
  en,
  fil,
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
