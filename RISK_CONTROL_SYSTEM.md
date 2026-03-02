# 🛡️ RISK CONTROL SYSTEM: MDJPRO Security Protocol

Este documento detalla las medidas de seguridad para proteger la plataforma contra hackeos, robo de datos y acceso no autorizado.

## 1. Control de Acceso Basado en Roles (RBAC)
No todos los usuarios tienen los mismos permisos. El sistema distingue tres niveles:

| Rol | Alcance | Protección |
| :--- | :--- | :--- |
| **MANAGER** | Acceso total al Panel de Control, Leads y DJs. | Verificación de `role == 'MANAGER'` en la base de datos antes de cargar el DOM. |
| **DJ PRO** | Acceso a herramientas y dashboard propio. | Solo puede ver SU información (RLS). |
| **CLIENTE** | Solo lectura/escritura de formulario de solicitud. | No tiene ID de usuario; el sistema solo recibe su lead. |

## 2. Row Level Security (RLS) - "Bingo Serrado" 🔒
Utilizamos las políticas de Supabase para asegurar que los datos no se fuguen:

*   **Tabla `dj_profiles`**: `CREATE POLICY "DJs solo ven su perfil" ON dj_profiles FOR SELECT USING (auth.uid() = user_id);`
*   **Tabla `leads`**: `CREATE POLICY "Solo Managers ven leads" ON leads FOR ALL USING (auth.jwt() ->> 'role' = 'manager');`
*   **Tabla `leads` (Escritura)**: `CREATE POLICY "Publico puede enviar leads" ON leads FOR INSERT WITH CHECK (true);`

## 3. Protección de Base de Clientes (Anti-Piratería)
Para evitar que un competidor o hacker robe tu lista de clientes:
1.  **Ofuscación en Client-Side**: El código JavaScript nunca descarga la lista completa de leads a menos que el usuario esté autenticado como Manager.
2.  **HTTPS Forzado**: Toda comunicación está cifrada punto a punto.
3.  **Sanitización de Inputs**: Evitamos inyecciones SQL en los formularios de contacto.

## 4. Medidas Contra Hacking
- **Rate Limiting**: El servidor bloquea IPs que intentan hacer spam en el formulario o login.
- **Manejo de Sesiones**: Tokens JWT que caducan automáticamente para evitar sesiones robadas.
- **Audit Logging**: Cada vez que se aprueba un DJ o se cambia un precio, queda un registro de quién lo hizo.

---
> [!CAUTION]
> NUNCA compartas tu contraseña de Supabase ni las API Keys "Service Role" en el código cliente. Solo usa la "Anon Key" protegida por RLS.
