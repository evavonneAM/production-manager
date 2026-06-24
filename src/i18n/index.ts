import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import ru from './locales/ru.json'
import es from './locales/es.json'

export const SUPPORTED_LANGUAGES = ['en', 'ru', 'es'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

// Before a user signs in we fall back to their browser/last-used language;
// once the profile loads, AuthProvider switches to their saved preference.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'pm-language',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
