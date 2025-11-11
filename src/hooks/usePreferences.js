import { useCallback } from 'react';

// Keep a weak map of last-applied CSS per document to avoid redundant writes
const lastCssPerDocument = new WeakMap();

// Creates CSS with high specificity to override internal styles - VERSION BÁSICA
export const useBuildPrefsCss = () => {
  return useCallback((p) => {
    const fontMap = {
      original: 'serif',
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      merri: '"Merriweather", Georgia, serif'
    };
    const fontFamily = fontMap[p.font] || 'serif';
    const bg = p.theme === 'dark' ? '#0b0c0c' : p.theme === 'sepia' ? '#f4ecd8' : '#ffffff';
    const color = p.theme === 'dark' ? '#e8f6f5' : '#222222';
    
    return `
      /* user prefs básicas - SOLO tema y fuente */
      body {
        background: ${bg} !important;
        color: ${color} !important;
        font-family: ${fontFamily} !important;
        font-size: ${p.fontSize}% !important;
        line-height: ${p.lineHeight} !important;
      }
    `;
  }, []);
};

// Injects CSS directly into each document/iframe created by epubjs
export const useInjectCssIntoContents = (DEBUG) => {
  return useCallback((rendition, css) => {
    if (!rendition) return;
    try {
      const contents = typeof rendition.getContents === 'function' ? rendition.getContents() : (rendition.contents || []);
      contents.forEach((c) => {
        const doc = c && (c.document || c.contentDocument || c.doc || (c.contents && c.contents[0]));
        const documentEl = doc && (doc.contentDocument || doc.ownerDocument || doc);
        if (!documentEl || !documentEl.head) return;
        let styleEl = documentEl.getElementById('user-prefs-style');
        if (!styleEl) {
          styleEl = documentEl.createElement('style');
          styleEl.id = 'user-prefs-style';
          documentEl.head.insertBefore(styleEl, documentEl.head.firstChild);
        }
        try {
          const previous = lastCssPerDocument.get(documentEl);
          if (previous === css) return; // no-op if identical
          // batch DOM write to next frame to avoid layout thrash
          window.requestAnimationFrame(() => {
            try {
              styleEl.textContent = css;
              lastCssPerDocument.set(documentEl, css);
            } catch (e) {
              if (DEBUG) console.warn('Error writing CSS to document:', e);
            }
          });
        } catch (e) {
          if (DEBUG) console.warn('Error preparing CSS injection:', e);
        }
      });
    } catch (e) {
      if (DEBUG) console.warn('Error injecting CSS:', e);
    }
  }, [DEBUG]);
};

// Registers theme (fallback) and injects with high specificity
export const useApplyPrefsToRendition = (buildPrefsCss, injectCssIntoContents, DEBUG) => {
  return useCallback((rendition, p) => {
    if (!rendition) return;
    const css = buildPrefsCss(p);
    try {
      rendition.themes && rendition.themes.register && rendition.themes.register('user-prefs', css);
      rendition.themes && rendition.themes.select && rendition.themes.select('user-prefs');
    } catch (e) {
      if (DEBUG) console.warn('Error applying theme:', e);
    }
    injectCssIntoContents(rendition, css);
  }, [buildPrefsCss, injectCssIntoContents, DEBUG]);
};