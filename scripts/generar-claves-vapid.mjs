// scripts/generar-claves-vapid.mjs
//
// Genera el par de claves VAPID que identifica a Miami DJ Beat ante Apple,
// Google y Mozilla. Se hace UNA vez.
//
// La PUBLICA la escribe el propio script en web/push-config.js -- no hay que
// copiarla a mano. La PRIVADA solo se imprime aqui: es una llave y no debe
// quedar escrita en ningun archivo del repositorio.
//
//   node scripts/generar-claves-vapid.mjs
//
import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "web", "push-config.js");

const b64url = (buf) => Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Aviso antes de nada: si ya habia una clave puesta, generar otra deja fuera a
// todo el que estuviera suscrito. Mejor saberlo antes que descubrirlo despues.
let yaHabia = "";
if (existsSync(destino)) {
    const m = readFileSync(destino, "utf8").match(/MDJ_VAPID_PUBLIC\s*=\s*"([^"]*)"/);
    yaHabia = (m && m[1]) || "";
}

const par = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
);
const publica = b64url(await crypto.subtle.exportKey("raw", par.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", par.privateKey);

// Se escribe sola en la pagina. Es publica por diseno: el navegador la necesita
// para suscribirse y viaja dentro del HTML de todas formas.
const archivo = `// web/push-config.js
// La clave PUBLICA de VAPID. Va aqui a proposito.
//
// NO es un secreto: identifica al remitente ante Apple y Google, esta pensada
// para viajar dentro de la pagina, y el navegador la necesita para suscribirse.
// La PRIVADA vive solo como secreto en Supabase y nunca baja al navegador.
//
// Generada el ${new Date().toISOString().slice(0, 10)} con:
//   node scripts/generar-claves-vapid.mjs
// NO editar a mano: volver a correr el script si hay que cambiarla.
window.MDJ_VAPID_PUBLIC = "${publica}";
`;
writeFileSync(destino, archivo, "utf8");

// Ademas se deja un .env temporal para poder cargar los tres secretos con UN
// comando. La pantalla de secretos de Supabase son seis cajas identicas sin
// etiqueta, y es facilisimo poner el valor en la casilla del nombre.
// El fichero se borra en cuanto se sube: lleva la clave privada dentro.
const sobre = join(raiz, ".vapid.env");
writeFileSync(sobre,
    `VAPID_PUBLIC_KEY=${publica}\n` +
    `VAPID_PRIVATE_KEY=${jwk.d}\n` +
    `VAPID_SUBJECT=mailto:miamidjbeat@gmail.com\n`,
    { encoding: "utf8", mode: 0o600 });   // 0600: solo tu usuario puede leerlo

console.log(`
${yaHabia ? `\x1b[33m╔════════════════════════════════════════════════════════════════════════════╗
║  OJO: ya habia una clave puesta y acabas de sustituirla.                   ║
║  Cualquiera que estuviera suscrito deja de recibir avisos y tendra que     ║
║  volver a dar permiso. Si no era lo que querias, avisa antes de seguir.    ║
╚════════════════════════════════════════════════════════════════════════════╝\x1b[0m
` : ""}
\x1b[32m✓ LISTO\x1b[0m  ·  la clave publica ya quedo escrita en web/push-config.js
           No tienes que copiarla a la pagina: eso ya esta hecho.

────────────────────────────────────────────────────────────────────────────
AHORA, LO UNICO QUE TE QUEDA A MANO:

NO hace falta tocar la pantalla de secretos de Supabase.
Copia esta linea entera, pegala en la Terminal y dale a Enter:

\x1b[36mnpx supabase@latest secrets set --env-file .vapid.env --project-ref hkuvuqupbxwkiykxvqdr\x1b[0m

(Puede pedirte la contrasena de tu Mac: es el llavero, que guarda el permiso
 del CLI de Supabase. Es normal y es la del Mac, no la de Supabase.)

Cuando termine, borra el sobre con las claves:

\x1b[36mrm .vapid.env\x1b[0m

────────────────────────────────────────────────────────────────────────────
\x1b[31mLA SEGUNDA (VAPID_PRIVATE_KEY) ES UNA LLAVE.\x1b[0m
No la pegues en un chat, ni en un correo, ni me la mandes a mi.
Solo va en ese campo de Supabase.

Las tres tienen que salir de ESTA misma corrida. Si mezclas claves de dos
corridas distintas, los avisos fallan sin decir por que.

Cuando termines, cierra esta ventana de terminal.
────────────────────────────────────────────────────────────────────────────
`);
