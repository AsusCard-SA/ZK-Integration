import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../locales/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [deviceDetails, setDeviceDetails] = useState(null);
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('zk_app_lang') || 'ar'; // Default to Arabic
  });

  useEffect(() => {
    localStorage.setItem('zk_app_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLanguage = () => {
    setLang(prev => (prev === 'ar' ? 'en' : 'ar'));
  };

  const t = (key) => {
    const value = translations[lang]?.[key] || translations['en']?.[key] || key;
    return value
      .replaceAll('MB2000', deviceDetails?.model || 'MB2000')
      .replaceAll('192.168.1.147', deviceDetails?.ip || '192.168.1.147');
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t, setDeviceDetails, isRtl: lang === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
