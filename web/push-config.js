// web/push-config.js
// La clave PUBLICA de VAPID. Va aqui a proposito.
//
// NO es un secreto: identifica al remitente ante Apple y Google, esta pensada
// para viajar dentro de la pagina, y el navegador la necesita para suscribirse.
// La PRIVADA vive solo como secreto en Supabase y nunca baja al navegador.
//
// Generada el 2026-08-21 con:
//   node scripts/generar-claves-vapid.mjs
// NO editar a mano: volver a correr el script si hay que cambiarla.
window.MDJ_VAPID_PUBLIC = "BDRyTX1biD7e_xQz-glXU4GKdAHFN6FpgVRc6donPNnTLH7yzEIf6jSZh71v1fDDtDD1qQgIygxypCfoXFXDIq4";
