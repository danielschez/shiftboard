import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase';

// Rutas (páginas y endpoints) que solo puede usar el super_admin.
// El admin normal solo puede dar de alta eventos.
const SUPER_ADMIN_PREFIXES = [
  '/admin/colaboradores',
  '/admin/turnos',
  '/admin/historial',
  '/admin/usuarios',
  '/admin/ajustes',
  '/api/admin/collaborators',
  '/api/admin/shifts',
  '/api/admin/historial',
  '/api/admin/users',
  '/api/admin/settings',
];

function isEventsDeleteRoute(path: string) {
  return /^\/api\/admin\/events\/[^/]+\/delete$/.test(path);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerClient(context.request, context.cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  context.locals.supabase = supabase;
  context.locals.user = user;
  context.locals.role = null;

  const path = context.url.pathname;
  const isApi = path.startsWith('/api/');
  const needsSession = (path.startsWith('/admin') && path !== '/admin/login') || path.startsWith('/api/admin');

  if (needsSession && !user) {
    if (isApi) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    return context.redirect('/admin/login');
  }

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    context.locals.role = (profile?.role as 'admin' | 'super_admin' | undefined) ?? 'admin';
  }

  const isSuperAdminOnly = SUPER_ADMIN_PREFIXES.some((p) => path.startsWith(p)) || isEventsDeleteRoute(path);

  if (user && isSuperAdminOnly && context.locals.role !== 'super_admin') {
    if (isApi) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para esta acción' }), { status: 403 });
    }
    return context.redirect(`/admin?error=${encodeURIComponent('No tienes permiso para acceder a esa sección')}`);
  }

  return next();
});
