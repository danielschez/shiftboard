# Calendario de colaboradores

Astro (SSR) + Supabase (Postgres + Auth) + Vercel.

- `/` — calendario público, solo lectura, con navegación de mes y colores por tipo de evento.
- `/admin` — panel protegido con login (Supabase Auth) para dar de alta colaboradores, turnos y eventos.

## 1. Crear el proyecto en Supabase

1. Ve a https://supabase.com/dashboard → **New project**.
2. Cuando termine de aprovisionarse, entra a **SQL Editor** → **New query**.
3. Copia y pega el contenido completo de `supabase/schema.sql` y dale **Run**.
   Esto crea las tablas, los datos iniciales (los 4 turnos y los 5 tipos de evento),
   la función/trigger que valida la cobertura de turno, y las políticas de RLS.
4. Ve a **Project Settings → API** y copia:
   - `Project URL` → lo usarás como `PUBLIC_SUPABASE_URL`
   - `anon public key` → lo usarás como `PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → lo usarás como `SUPABASE_SERVICE_ROLE_KEY`. **Nunca
     la publiques ni la pongas en una variable `PUBLIC_*`**: solo debe vivir
     como variable de entorno del servidor (local en `.env`, y en Vercel como
     variable normal, no expuesta al navegador). Con ella el panel puede
     crear/editar/eliminar usuarios reales desde `/admin/usuarios`.
5. Crea tu primer usuario para poder entrar por primera vez: **Authentication
   → Users → Add user** (correo + contraseña). Al crearse, se le asigna el rol
   `admin` en la tabla `profiles`. De ahí en adelante, ya puedes crear los
   demás usuarios directo desde `/admin/usuarios` — no vuelves a necesitar el
   dashboard de Supabase para esto.
6. **Vuélvete super_admin.** En el SQL Editor corre:

   ```sql
   update profiles set role = 'super_admin' where email = 'tu-correo@ejemplo.com';
   ```

## 2. Correr en local

```bash
cd calendario
npm install
cp .env.example .env
# edita .env y pega PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Abre `http://localhost:4321` para el calendario público y
`http://localhost:4321/admin` para el panel (te pedirá el login que creaste en el paso 1.5).

## 3. Desplegar en Vercel

```bash
npm install -g vercel   # si no lo tienes
vercel login
vercel
```

Cuando pregunte por variables de entorno, o después desde el dashboard de Vercel
(**Project → Settings → Environment Variables**), agrega:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (marca la casilla de "Sensitive" en Vercel;
  nunca debe llevar el prefijo `PUBLIC_`)

Vercel detecta automáticamente el adapter `@astrojs/vercel` y hace el build en modo SSR.
Para producción:

```bash
vercel --prod
```

## Roles

- **super_admin**: acceso total — colaboradores, turnos, eventos, historial,
  usuarios y ajustes.
- **admin**: solo ve y usa `/admin/eventos` (dar de alta eventos). Cualquier
  otra sección del admin, o su endpoint, redirige/rechaza con 403 aunque se
  intente entrar directo por URL — la restricción vive en el middleware
  (`src/middleware.ts`) y además en las políticas RLS de Supabase, así que no
  hay forma de saltársela ni llamando a la API directo.
- Los roles se administran en `/admin/usuarios` (solo super_admin).

## Usuarios (alta, edición, borrado)

Desde `/admin/usuarios` un super_admin puede:
- Crear un usuario nuevo (nombre, correo, contraseña y rol) — usa la
  `service_role` key server-side (`auth.admin.createUser`), nunca expuesta al
  navegador.
- Editar el nombre y el rol de cualquiera, y resetear su contraseña.
- Eliminar un usuario (no puedes eliminarte ni quitarte el rol de super_admin
  a ti mismo, para no dejarte fuera por accidente).

## Seguridad del login

`/api/auth/login` lleva control de intentos fallidos guardado en la tabla
`login_attempts` (solo accesible vía funciones `security definer`, nunca
directo):
- Después de **5 intentos fallidos** con el mismo correo en una ventana de
  **15 minutos**, se bloquea el login para ese correo hasta que pase la
  ventana — se muestra el mensaje correspondiente en `/admin/login`.
- Cada intento fallido muestra cuántos le quedan antes del bloqueo.
- Un login exitoso limpia el historial de intentos fallidos de ese correo.
- El mensaje de error siempre es genérico ("Credenciales inválidas") — nunca
  revela si el correo existe o no.
- Puedes ajustar `MAX_ATTEMPTS` y `WINDOW_MINUTES` al inicio de
  `src/pages/api/auth/login.ts` si quieres otros valores.

## Historial y exportación a Excel

`/admin/historial` (solo super_admin) muestra, por mes, cada evento con quién
lo dio de alta (`created_by_name`), cuándo (`created_at`) y su justificación.
El botón **Exportar a Excel** descarga un `.xlsx` de ese mismo mes
(`/api/admin/historial/export?y=AAAA&m=M`).

## Anticipación mínima y justificación

En `/admin/ajustes` (solo super_admin) se configura `min_notice_days`
(por defecto 15). Si alguien registra un evento de un tipo que requiere
anticipación (vacaciones, trámite o paternidad — columna `requires_notice`
en `event_types`) con menos días de los configurados, la base de datos
rechaza el `insert` a menos que venga con `justification` (texto plano);
el formulario de `/admin/eventos` ya incluye ese campo.

## Rotación de turnos

Tres turnos rotan en bloque cada 4 semanas, sincronizados para todos:
**7am-4pm → 11pm-7am → 3pm-11:30pm → (vuelve a 7am-4pm)**. El turno 9am-7pm
queda fijo, fuera de la rotación.

- `collaborators.shift_id` representa el turno de esa persona durante el
  periodo de 4 semanas que contiene a `app_settings.rotation_anchor_date`
  (la "fecha de referencia", configurable en `/admin/ajustes`).
- Para cualquier otra fecha — pasada o futura —, la función de Postgres
  `effective_shift_for_date(colaborador, fecha)` proyecta el turno
  correspondiente automáticamente. No hace falta actualizar nada cada 4
  semanas.
- **La regla de cobertura de turno usa el turno proyectado, no el actual.**
  Si alguien en 7am-4pm hoy pide vacaciones para dentro de 2 meses, el
  sistema valida la cobertura contra el turno que va a tener *ese día*
  (según la rotación), no el de hoy.
- `/admin/colaboradores` muestra el "turno base" (el guardado) junto al
  "turno hoy" (el proyectado) para cada quien, con una etiqueta "rotó"
  cuando ya cambiaron desde que se dio de alta.
- `/admin/turnos` muestra el ciclo completo y la fecha de referencia actual.

## Coberturas de backup y descanso compensatorio

Algunos colaboradores de 9am-7pm se marcan como **backup** (checkbox en
`/admin/colaboradores`). Cuando uno de ellos cubre otro turno:

1. Lo registras en `/admin/coberturas`: quién cubre, qué turno, del día A al
   día B.
2. El sistema revisa automáticamente qué sábados/domingos cayeron dentro de
   esas fechas y le genera al backup un **crédito de descanso compensatorio**
   por cada uno — utilizable solo la semana siguiente a ese fin de semana
   (lunes a domingo).
3. Cuando des de alta el evento **"Descanso compensatorio"** para ese
   colaborador en `/admin/eventos`, la base de datos exige que exista un
   crédito sin usar cuya ventana cubra esa fecha exacta; si no lo hay, lo
   rechaza con alerta (igual que las otras reglas). Si lo hay, lo consume.
4. `/admin/coberturas` también muestra la lista de créditos generados y si
   ya se usaron o siguen disponibles.

Si borras una cobertura, sus créditos (usados o no) se borran con ella; si
un crédito ya se había usado para un evento, ese evento queda huérfano de
crédito pero no se borra solo — bórralo a mano si aplica.

**Los créditos ya no tienen ventana de fecha.** Cualquier crédito sin usar
de un colaborador sirve para cualquier día (entre semana o fin de semana),
sin importar cuándo se ganó — se consume 1 crédito por cada día del evento,
empezando por el más antiguo. Las columnas `usable_from`/`usable_until` se
siguen calculando y mostrando en `/admin/coberturas` como referencia (la
semana "sugerida"), pero ya no bloquean nada.

**El calendario público muestra las coberturas de forma visual.** Mientras
un backup esté cubriendo otro turno (según lo registrado en
`/admin/coberturas`), esos días aparecen con un chip punteado
"Backup · Nombre" en `/` — es solo informativo, no crea ni requiere ningún
registro en `events`.

## Cómo funciona la regla de "no dejar el turno sin cobertura"

Vive en la base de datos (`supabase/schema.sql`, función `check_shift_coverage`),
no solo en el frontend, para que no se pueda saltar aunque alguien llame a la API
directo:

- Aplica a todos los tipos de evento **excepto paternidad** (columna `blocks_coverage`
  en `event_types` — puedes ajustar esto en Supabase si cambia la regla de negocio).
- Antes de guardar un evento, cuenta cuántos colaboradores **activos** hay en ese
  turno y cuántos de ellos ya tienen un evento aprobado que se traslapa con esas
  fechas.
- Si al aprobar este nuevo evento el turno se quedaría sin nadie cubriendo, la
  base de datos rechaza el `insert` con un mensaje claro, que el endpoint
  `/api/admin/events` captura y muestra como alerta en `/admin/eventos`.
- Si son turnos distintos, la validación ni siquiera se topa: cada turno se
  valida de forma independiente.

## Estructura

```
src/
  lib/            cliente de Supabase (SSR) y helpers de calendario
  middleware.ts   protege /admin/* verificando la sesión
  layouts/        Layout base y AdminLayout (nav + logout)
  pages/
    index.astro          calendario público
    admin/               páginas del panel (protegidas por middleware, algunas solo super_admin)
    api/auth/            login / logout
    api/admin/           endpoints de creación/edición/borrado, exportación e historial
supabase/
  schema.sql      tablas, seeds, función de cobertura, RLS
```
