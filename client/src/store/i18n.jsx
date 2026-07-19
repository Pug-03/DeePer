import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translate, LANGS } from '../i18n.js';

const KEY = 'dt_lang';

// Module-level mirror so non-component helpers (util.js) can localize too.
export let currentLang = localStorage.getItem(KEY) || 'th';

const I18nContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGS.some((l) => l.code === next)) return;
    currentLang = next;
    localStorage.setItem(KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
