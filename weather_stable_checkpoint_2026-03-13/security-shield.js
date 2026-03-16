/**
 * MDJPRO SECURITY SHIELD v1.0
 * Handles device fingerprinting and login verification.
 */

const MDJPRO_SECURITY = {
    /** Generates a simple device fingerprint based on browser environment. */
    getDeviceFingerprint: () => {
        const navigator_info = window.navigator.userAgent + window.navigator.language + screen.colorDepth + screen.height + screen.width;
        // Simple hash function for the fingerprint
        let hash = 0;
        for (let i = 0; i < navigator_info.length; i++) {
            const char = navigator_info.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `MDJ-${Math.abs(hash).toString(16).toUpperCase()}`;
    },

    /** Checks if the current device is known for the user. */
    checkDevice: async (user, db) => {
        const fingerprint = MDJPRO_SECURITY.getDeviceFingerprint();
        const userType = user.user_metadata?.user_type || 'client';
        const table = userType === 'talent' ? 'dj_profiles' : 'client_profiles';

        const { data: profile, error } = await db.from(table)
            .select('known_devices, security_preference, email, phone')
            .eq('user_id', user.id)
            .single();

        if (error || !profile) return { status: 'error', message: 'No se pudo verificar el dispositivo.' };

        const devices = profile.known_devices || [];
        const isKnown = devices.includes(fingerprint);

        if (!isKnown) {
            // New Device Detected!
            return {
                status: 'new_device',
                fingerprint,
                preference: profile.security_preference,
                email: profile.email,
                phone: profile.phone
            };
        }

        return { status: 'trusted', fingerprint };
    },

    /** Registers a new device after approval. */
    registerDevice: async (userId, userType, db) => {
        const fingerprint = MDJPRO_SECURITY.getDeviceFingerprint();
        const table = userType === 'talent' ? 'dj_profiles' : 'client_profiles';

        const { data: profile } = await db.from(table).select('known_devices').eq('user_id', userId).single();
        const devices = profile?.known_devices || [];

        if (!devices.includes(fingerprint)) {
            devices.push(fingerprint);
            await db.from(table).update({ known_devices: devices }).eq('user_id', userId);
            console.log(`[SECURITY SHIELD] Dispositivo ${fingerprint} registrado.`);
        }
    }
};

window.MDJPRO_SECURITY = MDJPRO_SECURITY;
