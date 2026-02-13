import { useEffect, useRef, useCallback, useState } from 'react';

declare global {
  interface Window {
    mtcaptchaConfig: {
      sitekey: string;
      renderQueue: string[];
      [key: string]: unknown;
    };
    mtcaptcha: {
      getVerifiedToken: () => string;
      resetUI: () => void;
      renderUI: (domID: string) => void;
    };
  }
}

export function useMTCaptcha(domId: string) {
  const rendered = useRef(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (rendered.current) return;

    const applyDarkTheme = () => {
      const el = document.getElementById(domId);
      if (!el) return;
      const iframe = el.querySelector('iframe');
      if (iframe) {
        iframe.style.filter = 'invert(0.88) hue-rotate(180deg)';
        iframe.style.borderRadius = '8px';
      }
    };

    const render = () => {
      if (window.mtcaptcha && typeof window.mtcaptcha.renderUI === 'function') {
        const el = document.getElementById(domId);
        if (el && !el.hasChildNodes()) {
          window.mtcaptcha.renderUI(domId);
          rendered.current = true;
          setTimeout(applyDarkTheme, 300);
        } else if (el && el.querySelector('iframe')) {
          applyDarkTheme();
        }
      }
    };

    const timer = setInterval(render, 500);
    render();

    return () => clearInterval(timer);
  }, [domId]);

  const getToken = useCallback((): string => {
    if (window.mtcaptcha && typeof window.mtcaptcha.getVerifiedToken === 'function') {
      const t = window.mtcaptcha.getVerifiedToken();
      setToken(t);
      return t;
    }
    return '';
  }, []);

  const reset = useCallback(() => {
    if (window.mtcaptcha && typeof window.mtcaptcha.resetUI === 'function') {
      window.mtcaptcha.resetUI();
    }
    setToken('');
    rendered.current = false;
  }, []);

  return { token, getToken, reset };
}
