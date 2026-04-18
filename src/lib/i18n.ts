import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Initialize i18next with default Arabic support
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {},
      },
      ar: {
        translation: {},
      },
    },
    lng: 'ar', // Default to Arabic as per the app's primary locale
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
