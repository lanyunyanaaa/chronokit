import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './zh-CN.json'
import en from './en.json'

export const LANGS = ['zh-CN', 'en'] as const
export type Lang = (typeof LANGS)[number]

const saved = (localStorage.getItem('ck-lang') as Lang | null) ?? 'zh-CN'

void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zh },
    en: { translation: en }
  },
  lng: saved,
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false }
})

export function persistLang(l: Lang): void {
  localStorage.setItem('ck-lang', l)
}
