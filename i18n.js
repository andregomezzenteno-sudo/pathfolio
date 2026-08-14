'use strict';
/*
 * i18n.js — cambio de idioma sin recargar y sin framework.
 *
 * Tres tipos de texto conviven en esta app y cada uno se resuelve distinto:
 *
 *  1. Texto fijo del HTML  -> atributos data-i18n, sustituidos al vuelo.
 *  2. Texto que se genera en JS con cifras dentro (avisos, narración,
 *     cifras destacadas) -> t('clave', {vars}) con interpolación.
 *  3. Contenido de datos (instrumentos, datos curiosos, arquetipos) -> vive
 *     en sus JSON, indexado por idioma; lo resuelve quien los lee.
 *
 * El idioma se guarda en localStorage y viaja en la URL, así que un enlace
 * compartido llega en el idioma en que se compartió. Se arranca en el del
 * navegador si no hay nada guardado: alguien que abre esto desde fuera de
 * España debería ver inglés sin tener que buscar el botón.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

const SUPPORTED = ['es', 'en'];
const STORAGE_KEY = 'pathfolio-lang';

let currentLang = 'es';
let catalog = {};          // textos del HTML, por clave
let dynamicCatalog = {};   // textos generados desde JS, por clave

function detectLang() {
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (SUPPORTED.includes(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch (e) { /* almacenamiento bloqueado: se sigue con el idioma del navegador */ }
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(nav) ? nav : 'en';
}

function getLang() { return currentLang; }

// Interpola {claves} dentro de la plantilla. Sin motor de plantillas: las
// cadenas de esta app son frases, no lógica.
function t(key, vars) {
  const raw = (dynamicCatalog[key] != null) ? dynamicCatalog[key] : key;
  if (!vars) return raw;
  return String(raw).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
}

// Elige la variante del idioma activo dentro de un objeto de datos: los
// instrumentos guardan sus textos en un bloque `en`, y si falta se cae al
// español en vez de dejar el hueco vacío.
function localized(obj, fields) {
  if (!obj) return obj;
  if (currentLang === 'es' || !obj.en) return obj;
  const out = { ...obj };
  (fields || Object.keys(obj.en)).forEach(f => {
    if (obj.en[f] != null) out[f] = obj.en[f];
  });
  return out;
}

// Aplica el catálogo a todo el HTML marcado. data-i18n sustituye texto plano;
// data-i18n-html permite marcado dentro (el pie lleva enlaces).
function applyToDom(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach(el => {
    const v = catalog[el.dataset.i18n];
    if (v != null) el.textContent = v;
  });
  scope.querySelectorAll('[data-i18n-html]').forEach(el => {
    const v = catalog[el.dataset.i18nHtml];
    if (v != null) el.innerHTML = v;
  });
  // Atributos (aria-label, title…): no son nodos de texto, así que no se ven
  // al mirar la pantalla, pero son justo lo que lee un lector de pantalla.
  // Formato: data-i18n-attr="aria-label:clave" (varios separados por coma).
  scope.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(x => x.trim());
      const v = catalog[key];
      if (attr && v != null) el.setAttribute(attr, v);
    });
  });
  // Los textos que no son nodos de texto: atributos y el idioma del documento.
  document.documentElement.lang = currentLang;
}

async function loadLanguage(lang, { dynamic } = {}) {
  currentLang = SUPPORTED.includes(lang) ? lang : 'es';
  try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) { /* sin persistencia */ }
  const res = await fetch(`i18n/${currentLang}.json`);
  catalog = await res.json();
  dynamicCatalog = (dynamic && dynamic[currentLang]) || {};
  applyToDom();
  return currentLang;
}

return { SUPPORTED, detectLang, getLang, t, localized, applyToDom, loadLanguage };
});
