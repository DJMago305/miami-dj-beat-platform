#!/usr/bin/env node
// tools/dj-profiles/build.mjs — Perfiles públicos de DJ (SEO/GEO/AEO)
//
// Genera una página estática real por cada DJ elegible en web/dj/<slug>.html
// — título, meta, canonical y JSON-LD Person horneados en el HTML (no dependen
// de JS para que Google/Siri/ChatGPT los lean), a diferencia de profile.html
// (que sigue existiendo tal cual, sin tocar — es la vista interactiva en vivo,
// enlazada desde aquí para quien quiera más detalle/disponibilidad real).
//
// Elegibilidad: requiere bio_short + photo_url reales (ninguna página pobre,
// por regla explícita del informe SEO). Un DJ sin esos dos campos queda fuera
// hasta que complete su perfil — y entra solo, sin tocar este script, la
// próxima vez que se corra.
//
// Orden: cuentas de pago/graduadas primero, gratis después (mismo criterio
// que ya usa find-dj.html vía MDB_SUBSCRIPTION.searchRankScore), y dentro de
// cada grupo, alfabético.
//
//   node tools/dj-profiles/build.mjs          → genera web/dj/*.html + actualiza sitemap.xml
//   node tools/dj-profiles/build.mjs --dry-run → solo imprime quién calificaría, no escribe nada
//
// Sin dependencias externas — usa fetch nativo (Node 18+). No modifica
// profile.html, directory.html, find-dj.html ni ninguna tabla de Supabase.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const WEB = join(ROOT, "web");
const OUT_DIR = join(WEB, "dj");
const SITEMAP = join(WEB, "sitemap.xml");

const SUPABASE_URL = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IMhi16lHj2dAk51AdUOK8w_U7s89-Ff";

const DRY_RUN = process.argv.includes("--dry-run");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escJs = (s) => String(s ?? "").replace(/</g, "\\u003C");

/* ═══ 1) traer datos reales, solo lectura ═══════════════════════════════ */

async function fetchDJs() {
  const cols = [
    "user_id", "dj_slug", "stage_name", "full_name", "photo_url", "background_url",
    "bio", "bio_short", "bio_en", "city", "roles", "artist_specialty", "plan", "plan_type",
    "plan_status", "is_premium", "available", "rating", "review_count", "is_resident",
    "instagram_url", "facebook_url", "tiktok_url", "youtube_url", "soundcloud_url",
    "apple_music_url", "spotify_url", "website_url",
  ].join(",");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/public_dj_profiles?select=${cols}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function isPaid(dj) {
  const t = `${dj.plan || ""} ${dj.plan_type || ""}`.toLowerCase();
  return /pro|founder|premium/.test(t) || dj.is_premium === true;
}

// public_dj_profiles mezcla todo el talento de "Entretenimiento y Talento"
// (bartenders, músicos, staff, etc.), no solo DJs — este generador es
// específicamente para el punto 4/5 del informe SEO ("perfiles públicos de
// DJs"), así que solo entra quien tenga un rol de DJ real. El resto de
// categorías (Hora Loca, MC, Payasos, Músicos...) ya tiene su propia puerta
// pública en services.html → "Entretenimiento y Talento" y no se toca aquí.
function isActuallyDJ(dj) {
  const hay = `${dj.artist_specialty || ""} ${dj.roles || ""}`.toLowerCase();
  return /\bdj\b/.test(hay);
}

function qualifies(dj) {
  // Owner es una cuenta separada de DJ (regla del proyecto: Owner nunca es
  // "artista") — excluida aunque tenga foto/bio, junto con cualquier fila
  // marcada Staff en vez de un rol de talento real.
  if (dj.dj_slug === "owner" || /\bstaff\b/i.test(dj.artist_specialty || "")) return false;
  if (!isActuallyDJ(dj)) return false;
  return Boolean((dj.bio || dj.bio_short) && dj.photo_url && dj.stage_name && dj.dj_slug);
}

// Ninguna reserva debe saltarse la plataforma: si un bio trae un teléfono
// personal suelto (pasó con un caso real de bartender), se quita antes de
// publicar. Toda conversión pasa por el CTA de Consultar Disponibilidad.
function stripPhoneNumbers(text) {
  return String(text || "").replace(/\+?\d[\d\s().-]{7,}\d/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/* ═══ 2) mapear especialidad → páginas de servicio existentes ══════════ */

const SERVICE_MAP = [
  { re: /quince/i, href: "./quinceanera.html", label: "Quinceañera DJ" },
  { re: /wedding|boda/i, href: "./weddings.html", label: "Wedding DJ" },
  { re: /corporate|corporativo/i, href: "./corporate.html", label: "Corporate DJ" },
  { re: /latin|open.?format/i, href: "./latin-dj.html", label: "Latin & Open Format DJ" },
  { re: /keys|cayos/i, href: "./florida-keys.html", label: "Florida Keys DJ" },
];

function relatedServices(dj) {
  const hay = `${dj.artist_specialty || ""} ${dj.roles || ""}`;
  const hits = SERVICE_MAP.filter((s) => s.re.test(hay));
  return hits.length ? hits : [{ href: "./services.html", label: "Servicios" }];
}

// Copiados literales de SOCIAL_ICONS en dj-profile.html (línea ~4589) — no
// se inventan íconos nuevos, mismo banco que ya usa la vista real.
const SOCIAL_SVG = {
  instagram_url: { label: "Instagram", svg: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>' },
  facebook_url: { label: "Facebook", svg: '<svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' },
  tiktok_url: { label: "TikTok", svg: '<svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"/></svg>' },
  youtube_url: { label: "YouTube", svg: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.6 5.8a3 3 0 0 0 2.1 2.1C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.5 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>' },
  soundcloud_url: { label: "SoundCloud", svg: '<svg viewBox="0 0 24 24"><path d="M12 7c-2.8 0-5.1 2.3-5.1 5.1 0 .2 0 .5.1.7-1.1.2-2 .8-2.6 1.7-.5 0-1 .2-1.4.5-.5.4-.9 1-.9 1.7 0 1.2 1 2.3 2.3 2.3h12.3C18.2 19 20 17.2 20 15c0-1.8-1.2-3.3-2.8-3.8-.2-2.3-2.1-4.2-4.4-4.2-.3 0-.5 0-.8.1zM10.8 19h-1.2v-7.6h1.2V19zm2.4 0h-1.2v-9.6h1.2V19zm2.4 0h-1.2v-7.6h1.2V19z" fill="currentColor"/></svg>' },
  apple_music_url: { label: "Apple Music", svg: '<svg viewBox="0 0 361 361"><path d="M254.5,55c-0.87,0.08-8.6,1.45-9.53,1.64l-107,21.59l-0.04,0.01c-2.79,0.59-4.98,1.58-6.67,3 c-2.04,1.71-3.17,4.13-3.6,6.95c-0.09,0.6-0.24,1.82-0.24,3.62c0,0,0,109.32,0,133.92c0,3.13-0.25,6.17-2.37,8.76 c-2.12,2.59-4.74,3.37-7.81,3.99c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01 c-4.98,1.93-8.71,4.39-11.68,7.51c-5.89,6.17-8.28,14.54-7.46,22.38c0.7,6.69,3.71,13.09,8.88,17.82 c3.49,3.2,7.85,5.63,12.99,6.66c5.33,1.07,11.01,0.7,19.31-0.98c4.42-0.89,8.56-2.28,12.5-4.61c3.9-2.3,7.24-5.37,9.85-9.11 c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1.19-8.7,1.19-13.26l0-116.15c0-6.22,1.76-7.86,6.78-9.08c0,0,88.94-17.94,93.09-18.75 c5.79-1.11,8.52,0.54,8.52,6.61l0,79.29c0,3.14-0.03,6.32-2.17,8.92c-2.12,2.59-4.74,3.37-7.81,3.99 c-2.33,0.47-4.66,0.94-6.99,1.41c-8.84,1.78-14.59,2.99-19.8,5.01c-4.98,1.93-8.71,4.39-11.68,7.51 c-5.89,6.17-8.49,14.54-7.67,22.38c0.7,6.69,3.92,13.09,9.09,17.82c3.49,3.2,7.85,5.56,12.99,6.6c5.33,1.07,11.01,0.69,19.31-0.98 c4.42-0.89,8.56-2.22,12.5-4.55c3.9-2.3,7.24-5.37,9.85-9.11c2.62-3.75,4.31-7.92,5.24-12.35c0.96-4.57,1-8.7,1-13.26V64.46 C263.54,58.3,260.29,54.5,254.5,55z" fill="currentColor" transform="scale(1.1) translate(-20, -20)"/></svg>' },
};

/* ═══ 3) plantilla ═══════════════════════════════════════════════════════ */

// Header/footer/scripts idénticos a los del resto del sitio (copiados
// literales de weddings.html, solo el timestamp de cache-bust cambia) —
// compartidos entre renderPage() y renderIndexPage() para no duplicar el
// bloque dos veces.
const HEADER_HTML = `  <header class="header mdj-header-unified" id="mainHeader">
    <div class="header-top">
      <div class="container">
        <div class="brand">
          <img src="./assets/branding/logo-transparent.webp" alt="Miami DJ Beat Logo" class="logo-img-eagle" width="256" height="256">
          <div class="brand-letters-wrapper">
            <img src="./assets/branding/logo-transparent-letras.webp" alt="Miami DJ Beat Letters" class="brand-letters-img" width="384" height="384">
          </div>
        </div>

        <div class="header-actions">
          <a href="./login.html?plan=pro" class="btn-pill gold" id="header-get-pro-btn" data-i18n="btn-get-pro">Get PRO</a>
          <a href="./login.html?signup=free" class="btn-pill" id="header-subscribe-free-btn" data-i18n="btn-subscribe-free">Suscripción gratis</a>
          <span id="header-djpro-badge" class="header-djpro-badge" style="display: none;" aria-label="DJPRO">DJPRO</span>
          <div class="mdj-header-r1-auth-cluster">

            <div class="lang-switcher">
            <span class="lang-btn" data-lang="es">ES</span>
            <span class="lang-pipe">|</span>
            <span class="lang-btn active" data-lang="en">EN</span>
          </div>

            <a href="./login.html" id="header-login-btn" class="btn-pill gold" data-i18n="btn-login">Log in</a>

            <div class="account session-pending" id="header-auth-zone" style="display: none;">
              <a class="account-btn" id="accountBtn" href="./dj-profile.html" title="Mi perfil" aria-label="Mi perfil">
                <img class="avatar" src="./assets/dj-avatar-placeholder.png" alt="" />
              </a>
            </div>

          </div>

          <div class="header-avatar-cart-row" aria-label="Account and cart">
<a href="./shop.html" id="header-cart-link" class="header-cart-btn" title="Cart" aria-label="Shopping cart">
              <span aria-hidden="true">🛒</span>
              <span id="header-cart-count" class="header-cart-count" hidden></span>
            </a>
          </div>
          <div class="header-search-wrap">
            <input type="search" id="header-smart-search" class="header-smart-search"
              placeholder="Search DJs, gear, services…" autocomplete="off" enterkeyhint="search" />
          </div>
        </div>

        <button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div class="mobile-overlay" id="mobileMenu">
          <nav class="mobile-nav">
            <a href="./index.html" data-i18n="nav-home" data-mdj-nav="home">Home</a>
            <a href="./rentals.html" data-i18n="nav-services" data-mdj-nav="services">Services</a>
            <a href="./events.html" data-i18n="nav-rentals" data-mdj-nav="venues">Events</a>
            <a href="./shop.html" style="color:#c5a059;font-weight:800;" data-mdj-nav="shop">Shop</a>
            <a href="./dj-tools.html" data-i18n="nav-tools" data-mdj-nav="tools">DJ Tools</a>
            <a href="./jobs.html" data-i18n="nav-jobs" data-mdj-nav="jobs">Jobs</a>
            <a href="./contact.html" data-i18n="nav-contact" data-mdj-nav="contact">Contacto</a>
            <a href="./login.html?signup=free" id="header-subscribe-free-mobile" data-i18n="btn-subscribe-free"
              style="color:rgba(255,255,255,0.88); font-weight:800;">Suscripción gratis</a>
            <a href="./login.html" id="header-login-btn-mobile" data-i18n="btn-login"
              style="color:var(--gold); font-weight:800;">Entrar</a>
            <a href="./dj-profile.html" id="nav-my-profile-mobile"
              style="display:none; color:var(--gold); font-weight:900;" data-i18n="menu-account">MY PROFILE</a>
          </nav>
        </div>
      </div>
    </div>
    <div class="header-nav">
      <div class="container">
        <nav class="nav top-nav mdj-mainnav-flex" id="mainNav">
    <a href="./index.html" data-i18n="nav-home" data-mdj-nav="home" data-mdj-slot="1">Inicio</a>
    <a href="./rentals.html" data-i18n="nav-services" data-mdj-nav="services" data-mdj-slot="2">Servicios</a>
    <a href="./events.html" data-i18n="nav-rentals" data-mdj-nav="venues" data-mdj-slot="3">Eventos</a>
    <a href="./shop.html" style="color:var(--gold);font-weight:800;" data-i18n="nav-shop" data-mdj-nav="shop" data-mdj-slot="4">Shop</a>
    <a href="./client-account.html" id="mainNav-config-link" class="mdj-config-mainnav mdj-mainnav-reserved-slot" data-mdj-nav="config" data-i18n="nav-config" data-mdj-slot="5" aria-hidden="true" tabindex="-1">⚙️ CONFIG</a>
    <a href="./jobs.html" data-i18n="nav-jobs" data-mdj-nav="jobs" data-mdj-slot="6">Trabajos</a>
    <a href="./contact.html" data-i18n="nav-contact" data-mdj-nav="contact" data-mdj-slot="7">Contacto</a>
    <a id="mainNav-mi-portal-link" class="mdj-mi-portal-mainnav mdj-mi-portal-gold mdj-mi-portal--guest" href="./client-portal.html" data-mdj-nav="mi-portal" data-mdj-slot="8" aria-hidden="true" tabindex="-1">MI PERFIL</a>
  </nav>

      </div>
    </div>
  </header>`;

const FOOTER_AND_SCRIPTS_HTML = `  <footer class="footer">
    <div class="container" style="text-align:center;padding:24px 16px;">
      <div class="mdjb-footer-services" style="margin-bottom:14px;font-size:13px;color:rgba(255,255,255,0.6);">
        <a href="./events.html" style="color:inherit;text-decoration:none;">Event Production</a> ·
        <a href="./rentals.html" style="color:inherit;text-decoration:none;">DJ Equipment Rental</a> ·
        <a href="./weddings.html" style="color:inherit;text-decoration:none;">Wedding DJ</a> ·
        <a href="./quinceanera.html" style="color:inherit;text-decoration:none;">Quinceañera DJ</a> ·
        <a href="./corporate.html" style="color:inherit;text-decoration:none;">Corporate Events</a> ·
        <a href="./latin-dj.html" style="color:inherit;text-decoration:none;">Latin &amp; Open-Format DJ</a> ·
        <a href="./florida-keys.html" style="color:inherit;text-decoration:none;">Florida Keys Destination DJ</a> ·
        <a href="./dj/directorio.html" style="color:inherit;text-decoration:none;">Directorio de DJs</a> ·
        <a href="./equipo.html" style="color:inherit;text-decoration:none;">Nuestro Equipo</a>
      </div>
      <div>© 2026 Miami DJ Beat LLC.</div>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3"></script>
  <script>
  (function () {
      var mdjLibAusente = !(window.supabase && typeof window.supabase.createClient === 'function');
      if (mdjLibAusente) {
          document.write('<script src="./vendor/supabase-js-2.112.3.legacy.js?v=20260818-safari-legacy"><\\/script>');
      }
  })();
  </script>
  <script src="./supabase-config.js?v=20260904-dj-profiles"></script>
  <script src="./translations.js?v=20260904-dj-profiles"></script>
  <script src="./i18n.js?v=20260904-dj-profiles"></script>
  <script src="./header-smart-search.js?v=20260904-dj-profiles"></script>
  <script src="./mdj-identity.js?v=20260904-dj-profiles"></script>
  <script src="./auth.js?v=20260904-dj-profiles"></script>
  <script src="./mdjb-shared-header.js?v=20260904-dj-profiles"></script>
  <script src="./mdj-mainnav-infinite.js?v=20260904-dj-profiles"></script>
  <script src="./mdj-mobile-header-fix.js?v=20260904-dj-profiles"></script>
`;

function renderPage(dj) {
  const name = dj.stage_name;
  const bio = stripPhoneNumbers(dj.bio || dj.bio_short || "");
  const bioParas = bio.split(/\n{2,}/).filter(Boolean);
  // Bilingüe real cuando existe bio_en: i18n.js ya pone lang="es"/"en" en
  // <html> al cambiar el switch (verificado en i18n.js) — se aprovecha ESE
  // atributo con CSS en vez de inventar un mecanismo de idioma nuevo. Si no
  // hay bio_en (caso real: DJSolitario, Owner), se muestra el único bio
  // disponible sin importar el idioma activo — no se inventa traducción.
  const bioEn = stripPhoneNumbers(dj.bio_en || "");
  const bioEnParas = bioEn ? bioEn.split(/\n{2,}/).filter(Boolean) : null;
  const city = dj.city || "Miami";
  const specialtyTags = (dj.artist_specialty || dj.roles || "")
    .split(/[·,]/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const services = relatedServices(dj);
  const title = `${esc(name)} — DJ en Miami | Miami DJ Beat`;
  // Colapsar saltos de línea del bio ANTES de cortar a 155 caracteres — un
  // \n crudo dentro de content="..." rompía la etiqueta en un caso real
  // (DJSolitario, bio con salto de línea propio).
  const bioFlat = bio.replace(/\s+/g, " ").trim();
  const metaDesc = esc(bioFlat.slice(0, 155).trim() + (bioFlat.length > 155 ? "…" : ""));
  const canonical = `https://miamidjbeat.com/dj/${dj.dj_slug}.html`;

  const sameAs = [dj.instagram_url, dj.facebook_url, dj.tiktok_url, dj.youtube_url, dj.soundcloud_url, dj.apple_music_url, dj.spotify_url]
    .filter(Boolean);

  const socialLinks = Object.keys(SOCIAL_SVG)
    .filter((field) => dj[field])
    .map((field) => ({ href: dj[field], ...SOCIAL_SVG[field] }));

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle: "DJ",
    image: dj.photo_url,
    description: bio.slice(0, 500),
    address: { "@type": "PostalAddress", addressLocality: city, addressRegion: "FL", addressCountry: "US" },
    worksFor: { "@type": "EntertainmentBusiness", name: "Miami DJ Beat LLC", url: "https://miamidjbeat.com/" },
    url: canonical,
    ...(sameAs.length ? { sameAs } : {}),
    ...(dj.rating ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: dj.rating,
        reviewCount: Math.max(1, dj.review_count || 1),
      },
    } : {}),
  };

  const bookingHref = `./client-portal.html?dj_name=${encodeURIComponent(name)}&ref=${encodeURIComponent(dj.dj_slug)}`;
  // Enlaza directo a la vista pública real (dj-profile.html?view=public) en
  // vez de pasar por profile.html — esa página ahora es solo un redirect de
  // compatibilidad para links/QR viejos, no la fuente de verdad.
  const liveProfileHref = `./dj-profile.html?id=${encodeURIComponent(dj.user_id)}&view=public`;

  return `<!doctype html>
<html lang="es">

<head>
  <meta charset="utf-8" />
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="canonical" href="${canonical}" />
  <meta name="description" content="${metaDesc}" />
  <script type="application/ld+json">${JSON.stringify(personLd)}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=optional" rel="stylesheet" />
  <link rel="stylesheet" href="./styles.css?v=20260904-dj-profiles" />
  <link rel="stylesheet" href="./header-unified.css?v=20260902-cortinas" />
  <link rel="stylesheet" href="./mdj-assistant.css?v=20260306-1" />
  <style>
    .djp-hero{max-width:1100px;margin:40px auto;padding:0 20px;display:grid;grid-template-columns:260px 1fr;gap:36px;align-items:start;}
    @media (max-width:760px){.djp-hero{grid-template-columns:1fr;text-align:center;}}
    .djp-photo{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:16px;border:1px solid rgba(197,160,89,0.35);}
    .djp-name{font-family:"Cormorant Garamond",serif;font-size:2.6rem;color:#c5a059;margin:0 0 6px;}
    .djp-meta{color:rgba(255,255,255,0.65);margin-bottom:14px;}
    .djp-tags{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;}
    .djp-tag{font-size:12px;padding:4px 10px;border:1px solid rgba(197,160,89,0.35);border-radius:999px;color:#e8c987;}
    .djp-bio p{line-height:1.7;color:rgba(255,255,255,0.85);margin:0 0 14px;}
    .djp-bio-en{display:none;}
    html[lang="en"] .djp-bio-es{display:none;}
    html[lang="en"] .djp-bio-en{display:block;}
    .djp-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px;}
    .djp-btn{display:inline-block;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;}
    .djp-btn.gold{background:#c5a059;color:#0b0f18;}
    .djp-btn.ghost{border:1px solid rgba(197,160,89,0.4);color:#e8c987;}
    .djp-social{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;}
    .djp-social a{width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;transition:all 0.2s ease;}
    .djp-social a:hover{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.3);transform:translateY(-2px);}
    .djp-social svg{width:18px;height:18px;fill:currentColor;}
    .djp-services{max-width:1100px;margin:10px auto 50px;padding:0 20px;}
    .djp-services h2{font-family:"Cormorant Garamond",serif;color:#c5a059;font-size:1.6rem;font-weight:600;max-width:700px;}
    .djp-contact-row{display:flex;flex-wrap:wrap;gap:20px;margin:12px 0 22px;}
    .djp-contact-row a{color:#e8c987;text-decoration:none;font-size:15px;font-weight:600;}
    .djp-contact-row a:hover{text-decoration:underline;}
    .djp-services .row{display:flex;flex-wrap:wrap;gap:10px;}
    .djp-services a{padding:10px 16px;border:1px solid rgba(197,160,89,0.3);border-radius:10px;color:#e8c987;text-decoration:none;font-size:14px;}
  </style>
</head>

<body class="notranslate page-dj-profile">
${HEADER_HTML}

  <main>
    <div class="djp-hero">
      <img class="djp-photo" src="${esc(dj.photo_url)}" alt="${esc(name)} — DJ en ${esc(city)}, Miami DJ Beat" loading="eager" fetchpriority="high" />
      <div>
        <h1 class="djp-name">${esc(name)}</h1>
        <div class="djp-meta">📍 ${esc(city)}${dj.is_resident ? " · DJ Residente" : ""}${dj.rating ? ` · ★ ${esc(dj.rating)} (${esc(dj.review_count || 0)})` : ""}</div>
        ${specialtyTags.length ? `<div class="djp-tags">${specialtyTags.map((t) => `<span class="djp-tag">${esc(t)}</span>`).join("")}</div>` : ""}
        <div class="djp-bio djp-bio-es">${bioParas.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${bioEnParas ? `<div class="djp-bio djp-bio-en">${bioEnParas.map((p) => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
        <div class="djp-cta">
          <a class="djp-btn gold" href="${bookingHref}">Consultar Disponibilidad</a>
          <a class="djp-btn ghost" href="${liveProfileHref}">Perfil Artístico</a>
        </div>
        ${socialLinks.length ? `<div class="djp-social">${socialLinks.map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer" title="${s.label}" aria-label="${s.label}">${s.svg}</a>`).join("")}</div>` : ""}
      </div>
    </div>

    <div class="djp-services">
      <h2>Comunícate con nosotros y pregunta por ${esc(name)} — o cualquiera de tus DJs favoritos de nuestra plataforma</h2>
      <div class="djp-contact-row">
        <a href="tel:+13056071780">📞 (305) 607-1780</a>
        <a href="mailto:miamidjbeat@gmail.com">✉️ miamidjbeat@gmail.com</a>
      </div>
      <div class="row">
        ${services.map((s) => `<a href="${s.href}">${esc(s.label)}</a>`).join("")}
        <a href="./dj/directorio.html">Ver todos los DJs</a>
      </div>
    </div>
  </main>

${FOOTER_AND_SCRIPTS_HTML}
</body>
</html>
`;
}

/* ═══ 3b) índice estático — enlazado interno real, no dependiente de JS ═══
   find-dj.html/directory.html renderizan por JS: un rastreador que no
   ejecuta JS nunca ve esos <a href>. Este índice es HTML plano, con links
   reales horneados, para que Google/Siri/ChatGPT puedan descubrir cada
   perfil por enlace interno y no solo por el sitemap. */

function renderIndexPage(djs) {
  const cards = djs.map((dj) => {
    const city = dj.city || "Miami";
    const bio = stripPhoneNumbers(dj.bio || dj.bio_short || "").slice(0, 140);
    return `
      <a class="djidx-card" href="./dj/${dj.dj_slug}.html">
        <img src="${esc(dj.photo_url)}" alt="${esc(dj.stage_name)}" loading="lazy" />
        <div>
          <h2>${esc(dj.stage_name)}</h2>
          <p class="djidx-city">📍 ${esc(city)}${isPaid(dj) ? " · PRO" : ""}</p>
          <p class="djidx-bio">${esc(bio)}${bio.length >= 140 ? "…" : ""}</p>
        </div>
      </a>`;
  }).join("");

  return `<!doctype html>
<html lang="es">

<head>
  <meta charset="utf-8" />
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Directorio de DJs en Miami | Miami DJ Beat</title>
  <link rel="canonical" href="https://miamidjbeat.com/dj/directorio.html" />
  <meta name="description" content="DJs profesionales de Miami DJ Beat — bodas, quinceañeras, eventos corporativos y Latin/Open Format. Perfiles reales, disponibilidad y contacto directo." />
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: djs.map((dj, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://miamidjbeat.com/dj/${dj.dj_slug}.html`,
      name: dj.stage_name,
    })),
  })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=optional" rel="stylesheet" />
  <link rel="stylesheet" href="./styles.css?v=20260904-dj-profiles" />
  <link rel="stylesheet" href="./header-unified.css?v=20260902-cortinas" />
  <link rel="stylesheet" href="./mdj-assistant.css?v=20260306-1" />
  <style>
    .djidx-wrap{max-width:1100px;margin:40px auto;padding:0 20px;}
    .djidx-wrap h1{font-family:"Cormorant Garamond",serif;color:#c5a059;font-size:2.4rem;margin-bottom:6px;}
    .djidx-wrap>p{color:rgba(255,255,255,0.65);margin-bottom:28px;}
    .djidx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;}
    .djidx-card{display:flex;gap:14px;padding:14px;border:1px solid rgba(197,160,89,0.25);border-radius:14px;text-decoration:none;color:inherit;}
    .djidx-card img{width:72px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0;}
    .djidx-card h2{font-size:1.1rem;margin:0 0 4px;color:#e8c987;}
    .djidx-city{font-size:12px;color:rgba(255,255,255,0.55);margin:0 0 6px;}
    .djidx-bio{font-size:13px;color:rgba(255,255,255,0.7);margin:0;line-height:1.5;}
  </style>
</head>

<body class="notranslate page-dj-index">
${HEADER_HTML}

  <main>
    <div class="djidx-wrap">
      <h1>Directorio de DJs</h1>
      <p>DJs profesionales de Miami DJ Beat, con disponibilidad real y reserva directa.</p>
      <div class="djidx-grid">${cards}</div>
    </div>
  </main>

${FOOTER_AND_SCRIPTS_HTML}
</body>
</html>
`;
}

/* ═══ 3c) equipo — página corporativa "Sobre Nosotros" ══════════════════
   Propósito distinto al de los perfiles de DJ: no es "reserva a esta
   persona", es autoridad/confianza para Google (señales E-E-A-T) y para que
   ChatGPT/Siri puedan responder "quién está detrás de Miami DJ Beat". Usa
   las mismas filas de public_dj_profiles marcadas artist_specialty="Staff"
   (Owner/Managers/Vendedores) — hoy solo existe el Owner, el resto entra
   solo cuando se den de alta esas cuentas, mismo patrón que los DJs. */

const STAFF_TITLE_BY_SLUG = {
  owner: "Fundador &amp; Propietario",
};

function qualifiesStaff(dj) {
  return Boolean(/\bstaff\b/i.test(dj.artist_specialty || "") && (dj.bio || dj.bio_short) && dj.photo_url && dj.stage_name && dj.dj_slug);
}

function renderTeamPage(staff) {
  const cards = staff.map((s) => {
    const bio = stripPhoneNumbers(s.bio || s.bio_short || "");
    const bioParas = bio.split(/\n{2,}/).filter(Boolean);
    const title = STAFF_TITLE_BY_SLUG[s.dj_slug] || "Equipo Miami DJ Beat";
    const socialLinks = [
      s.instagram_url && { href: s.instagram_url, label: "Instagram" },
      s.facebook_url && { href: s.facebook_url, label: "Facebook" },
      s.tiktok_url && { href: s.tiktok_url, label: "TikTok" },
      s.youtube_url && { href: s.youtube_url, label: "YouTube" },
      s.linkedin_url && { href: s.linkedin_url, label: "LinkedIn" },
    ].filter(Boolean);
    return `
      <article class="team-card">
        <img class="team-photo" src="${esc(s.photo_url)}" alt="${esc(s.stage_name)} — ${title.replace(/&amp;/g, "&")}, Miami DJ Beat LLC" loading="lazy" />
        <div>
          <h2>${esc(s.stage_name)}</h2>
          <p class="team-title">${title}</p>
          <div class="team-bio">${bioParas.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
          ${socialLinks.length ? `<div class="team-social">${socialLinks.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${l.label}</a>`).join("")}</div>` : ""}
        </div>
      </article>`;
  }).join("");

  const personLd = staff.map((s) => ({
    "@type": "Person",
    name: s.stage_name,
    jobTitle: (STAFF_TITLE_BY_SLUG[s.dj_slug] || "Equipo Miami DJ Beat").replace(/&amp;/g, "&"),
    image: s.photo_url,
    worksFor: { "@type": "EntertainmentBusiness", name: "Miami DJ Beat LLC", url: "https://miamidjbeat.com/" },
  }));

  return `<!doctype html>
<html lang="es">

<head>
  <meta charset="utf-8" />
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Equipo — Miami DJ Beat LLC</title>
  <link rel="canonical" href="https://miamidjbeat.com/equipo.html" />
  <meta name="description" content="Conoce al equipo detrás de Miami DJ Beat LLC — fundador, dirección y el equipo que impulsa la plataforma de DJs y producción de eventos en Miami." />
  <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": personLd })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Outfit:wght@300;400;500;600;700&display=optional" rel="stylesheet" />
  <link rel="stylesheet" href="./styles.css?v=20260904-dj-profiles" />
  <link rel="stylesheet" href="./header-unified.css?v=20260902-cortinas" />
  <link rel="stylesheet" href="./mdj-assistant.css?v=20260306-1" />
  <style>
    .team-wrap{max-width:1000px;margin:40px auto;padding:0 20px;}
    .team-wrap h1{font-family:"Cormorant Garamond",serif;color:#c5a059;font-size:2.4rem;margin-bottom:6px;}
    .team-wrap>p{color:rgba(255,255,255,0.65);margin-bottom:28px;}
    .team-card{display:grid;grid-template-columns:220px 1fr;gap:28px;padding:24px 0;border-top:1px solid rgba(197,160,89,0.2);}
    .team-card:first-of-type{border-top:none;}
    @media (max-width:640px){.team-card{grid-template-columns:1fr;text-align:center;}}
    .team-photo{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:14px;border:1px solid rgba(197,160,89,0.35);}
    .team-card h2{font-family:"Cormorant Garamond",serif;color:#e8c987;font-size:1.6rem;margin:0 0 2px;}
    .team-title{color:#c5a059;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 12px;}
    .team-bio p{line-height:1.7;color:rgba(255,255,255,0.85);margin:0 0 12px;}
    .team-social{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;}
    .team-social a{color:rgba(255,255,255,0.6);text-decoration:none;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.2);}
  </style>
</head>

<body class="notranslate page-team">
${HEADER_HTML}

  <main>
    <div class="team-wrap">
      <h1>Nuestro Equipo</h1>
      <p>Las personas detrás de Miami DJ Beat LLC.</p>
      ${cards}
    </div>
  </main>

${FOOTER_AND_SCRIPTS_HTML}
</body>
</html>
`;
}

/* ═══ 4) sitemap ═════════════════════════════════════════════════════════ */

function upsertSitemap(paths) {
  let xml = readFileSync(SITEMAP, "utf8");
  let added = 0;
  for (const { path, priority } of paths) {
    const loc = `https://miamidjbeat.com/${path}`;
    if (xml.includes(`<loc>${loc}</loc>`)) continue;
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
    xml = xml.replace("</urlset>", `${entry}</urlset>`);
    added++;
  }
  if (added && !DRY_RUN) writeFileSync(SITEMAP, xml, "utf8");
  return added;
}

/* ═══ main ═══════════════════════════════════════════════════════════════ */

async function main() {
  const all = await fetchDJs();
  const qualified = all.filter(qualifies);
  const skipped = all.filter((d) => !qualifies(d));

  qualified.sort((a, b) => {
    const pa = isPaid(a) ? 0 : 1;
    const pb = isPaid(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.stage_name || "").localeCompare(b.stage_name || "");
  });

  console.log(`Total DJs en public_dj_profiles: ${all.length}`);
  console.log(`Elegibles (bio + foto reales): ${qualified.length}`);
  qualified.forEach((d, i) => console.log(`  ${i + 1}. ${d.dj_slug}  (${isPaid(d) ? "PAGO" : "gratis"})  — ${d.stage_name}`));
  if (skipped.length) {
    console.log(`Pendientes de completar perfil (sin página todavía): ${skipped.length}`);
    skipped.forEach((d) => console.log(`  - ${d.dj_slug || d.user_id}: falta ${!d.bio_short && !d.bio ? "bio" : ""}${!d.photo_url ? " foto" : ""}`));
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: no se escribió ningún archivo.");
    return;
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  for (const dj of qualified) {
    const html = renderPage(dj);
    writeFileSync(join(OUT_DIR, `${dj.dj_slug}.html`), html, "utf8");
    console.log(`✓ web/dj/${dj.dj_slug}.html`);
  }

  const indexHtml = renderIndexPage(qualified);
  writeFileSync(join(OUT_DIR, "directorio.html"), indexHtml, "utf8");
  console.log(`✓ web/dj/directorio.html (${qualified.length} perfiles listados)`);

  const staff = all.filter(qualifiesStaff);
  console.log(`Staff elegible (Sobre Nosotros): ${staff.length}`);
  staff.forEach((s) => console.log(`  - ${s.dj_slug} — ${s.stage_name}`));
  const teamHtml = renderTeamPage(staff);
  writeFileSync(join(WEB, "equipo.html"), teamHtml, "utf8");
  console.log(`✓ web/equipo.html (${staff.length} miembros listados)`);

  const sitemapPaths = [
    { path: "dj/directorio.html", priority: "0.8" },
    { path: "equipo.html", priority: "0.6" },
    ...qualified.map((d) => ({ path: `dj/${d.dj_slug}.html`, priority: "0.7" })),
  ];
  const added = upsertSitemap(sitemapPaths);
  console.log(`sitemap.xml: ${added} URL(s) nueva(s) agregada(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
