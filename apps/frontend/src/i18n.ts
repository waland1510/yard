import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationEN from './locales/en.json';
import translationFR from './locales/fr.json';
import translationUK from "./locales/ua.json";
import translationPL from "./locales/pl.json";
import translationJA from "./locales/ja.json";
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const languageDetector = new LanguageDetector(null, {
  order: ['navigator'],
  caches: [],
});

i18n
  .use(HttpApi)
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: translationEN,
      },
      fr: {
        translation: translationFR,
      },
      uk: {
        translation: translationUK,
      },
      ja: {
        translation: translationJA,
      },
      pl: {
        translation: translationPL,
      },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
