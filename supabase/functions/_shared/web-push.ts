// supabase/functions/_shared/web-push.ts
// ─────────────────────────────────────────────────────────────────────────────
// El motor de Web Push, escrito a mano sobre Web Crypto. Sin dependencias.
//
// Dos cosas pasan aqui, y conviene no confundirlas:
//
//   1. VAPID  -- firma que dice "esto lo manda Miami DJ Beat". Es lo que hace
//      que Apple y Google acepten el aviso en vez de tirarlo.
//   2. RFC 8291 -- el CIFRADO del contenido. El aviso lleva el nombre del
//      cliente y los datos de su evento, y pasa por servidores de Apple,
//      Google y Mozilla. Va cifrado para ESE dispositivo: ni ellos ni nosotros
//      podemos leerlo despues de salir de aqui.
//
// Sin el punto 2 el mensaje viajaria en claro por servidores de terceros. No
// es opcional: el navegador rechaza el aviso si no viene cifrado asi.
// ─────────────────────────────────────────────────────────────────────────────

export interface Suscripcion {
    endpoint: string;
    p256dh: string;
    auth: string;
}

const cr = crypto;

// ── utilidades de base64url ───────────────────────────────────────────────────
export function b64urlDec(s: string): Uint8Array {
    const t = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export function b64urlEnc(b: Uint8Array | ArrayBuffer): string {
    const u = b instanceof Uint8Array ? b : new Uint8Array(b);
    let s = "";
    for (const x of u) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unir(...partes: Uint8Array[]): Uint8Array {
    const total = partes.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let i = 0;
    for (const p of partes) { out.set(p, i); i += p.length; }
    return out;
}

// ── HKDF ──────────────────────────────────────────────────────────────────────
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number) {
    const k = await cr.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    const bits = await cr.subtle.deriveBits(
        { name: "HKDF", hash: "SHA-256", salt, info }, k, largo * 8,
    );
    return new Uint8Array(bits);
}

const texto = (s: string) => new TextEncoder().encode(s);

// ── 1. LA FIRMA (VAPID) ───────────────────────────────────────────────────────
// El JWT dura 12h. Se firma por destino, porque el "aud" cambia segun sea
// Apple, Google o Mozilla.
async function firmaVapid(endpoint: string, publica: string, privadaD: string, sujeto: string) {
    const raw = b64urlDec(publica);             // 0x04 || x(32) || y(32)
    if (raw.length !== 65) throw new Error("vapid_publica_invalida");

    const clave = await cr.subtle.importKey(
        "jwk",
        {
            kty: "EC", crv: "P-256", ext: true,
            x: b64urlEnc(raw.slice(1, 33)),
            y: b64urlEnc(raw.slice(33, 65)),
            d: privadaD,
        },
        { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
    );

    const cab = { typ: "JWT", alg: "ES256" };
    const cuerpo = {
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: sujeto,
    };
    const base = `${b64urlEnc(texto(JSON.stringify(cab)))}.${b64urlEnc(texto(JSON.stringify(cuerpo)))}`;
    // Web Crypto ya devuelve la firma en r||s, que es justo lo que quiere JWT.
    const firma = await cr.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, clave, texto(base));
    return `${base}.${b64urlEnc(firma)}`;
}

// ── 2. EL CIFRADO (RFC 8291, aes128gcm) ───────────────────────────────────────
async function cifrar(sub: Suscripcion, mensaje: string) {
    const uaPublic = b64urlDec(sub.p256dh);     // clave publica del dispositivo
    const authSecret = b64urlDec(sub.auth);     // secreto compartido del navegador

    // Par efimero: uno nuevo por cada aviso. Reutilizarlo debilitaria el cifrado.
    const efimero = await cr.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
    ) as CryptoKeyPair;
    const asPublic = new Uint8Array(await cr.subtle.exportKey("raw", efimero.publicKey));

    const otro = await cr.subtle.importKey(
        "raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, [],
    );
    const compartido = new Uint8Array(
        await cr.subtle.deriveBits({ name: "ECDH", public: otro }, efimero.privateKey, 256),
    );

    // El orden de esta concatenacion lo fija la norma. Si se invierte, el
    // navegador descarta el aviso sin decir por que -- trampa clasica.
    const prk = await hkdf(
        authSecret, compartido,
        unir(texto("WebPush: info\0"), uaPublic, asPublic), 32,
    );

    const salt = cr.getRandomValues(new Uint8Array(16));
    const cek = await hkdf(salt, prk, texto("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, prk, texto("Content-Encoding: nonce\0"), 12);

    const aes = await cr.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
    // El 0x02 marca el final del ultimo registro. Sin el, no descifra.
    const claro = unir(texto(mensaje), new Uint8Array([0x02]));
    const cifrado = new Uint8Array(
        await cr.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aes, claro),
    );

    // Cabecera: salt(16) | tamano de registro(4) | largo de la clave(1) | clave(65)
    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, 4096);
    return unir(salt, rs, new Uint8Array([asPublic.length]), asPublic, cifrado);
}

// ── 3. EL ENVIO ───────────────────────────────────────────────────────────────
export interface Resultado {
    ok: boolean;
    estado: number;
    /** true cuando el buzon ya no existe: hay que BORRAR la fila, no reintentar. */
    muerto: boolean;
}

export async function enviarPush(
    sub: Suscripcion,
    carga: Record<string, unknown>,
    vapid: { publica: string; privada: string; sujeto: string },
): Promise<Resultado> {
    const cuerpo = await cifrar(sub, JSON.stringify(carga));
    const jwt = await firmaVapid(sub.endpoint, vapid.publica, vapid.privada, vapid.sujeto);

    const r = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
            "Authorization": `vapid t=${jwt}, k=${vapid.publica}`,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            // Si el telefono esta apagado, se guarda 24h y se entrega al volver.
            "TTL": "86400",
        },
        body: cuerpo,
    });

    // 404/410 = el usuario desinstalo o retiro el permiso. Insistir es gastar
    // llamadas contra un buzon que ya no existe.
    return { ok: r.ok, estado: r.status, muerto: r.status === 404 || r.status === 410 };
}
