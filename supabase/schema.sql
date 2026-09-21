-- =========================================================
-- Esquema: Calendario de colaboradores
-- Este archivo es idempotente: puedes volver a correrlo completo
-- las veces que quieras (incluso si ya lo habías corrido antes),
-- en Supabase -> SQL Editor -> Run.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Turnos
-- ---------------------------------------------------------
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

insert into shifts (name, start_time, end_time) values
  ('7am - 4pm', '07:00', '16:00'),
  ('3pm - 11:30pm', '15:00', '23:30'),
  ('11pm - 7am', '23:00', '07:00'),
  ('9am - 7pm', '09:00', '19:00')
on conflict do nothing;

-- ---------------------------------------------------------
-- Colaboradores
-- ---------------------------------------------------------
create table if not exists collaborators (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  shift_id uuid not null references shifts(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tipos de evento (catálogo con color, si bloquea cobertura
-- y si requiere validar los días de anticipación)
-- ---------------------------------------------------------
create table if not exists event_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null,
  color text not null,
  blocks_coverage boolean not null default false,
  requires_notice boolean not null default false
);

-- por si ya tenías la tabla de la versión anterior (sin esta columna), agrégala primero
alter table event_types add column if not exists requires_notice boolean not null default false;

insert into event_types (code, label, color, blocks_coverage, requires_notice) values
  ('vacaciones',  'Vacaciones',              '#2E7D32', true,  true),
  ('tramite',     'Día de trámite',          '#1565C0', true,  true),
  ('paternidad',  'Paternidad / Maternidad', '#6A1B9A', false, true),
  ('cumpleanios', 'Cumpleaños',              '#EF6C00', true,  false),
  ('festivo',     'Día festivo',             '#C62828', true,  false)
on conflict (code) do nothing;

update event_types set requires_notice = true where code in ('vacaciones', 'tramite', 'paternidad');

-- ---------------------------------------------------------
-- Perfiles: liga cada usuario de Supabase Auth a un rol.
--   - super_admin: hace todo (colaboradores, turnos, eventos,
--     historial, usuarios, ajustes).
--   - admin: solo puede dar de alta eventos.
-- ---------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil (rol admin por defecto) cada vez
-- que se da de alta un usuario nuevo en Authentication -> Users.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Da de alta perfiles para usuarios de Auth que ya existían antes de este cambio
insert into profiles (id, email, full_name, role)
select u.id, u.email, u.email, 'admin'
from auth.users u
left join profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Función auxiliar para las políticas de RLS: ¿el usuario actual es super_admin?
-- security definer para no depender de las políticas de "profiles" y evitar recursión.
create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'super_admin');
$$;

-- ---------------------------------------------------------
-- Ajustes generales (días de anticipación mínimos)
-- ---------------------------------------------------------
create table if not exists app_settings (
  id int primary key default 1,
  min_notice_days int not null default 15,
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, min_notice_days) values (1, 15)
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- Eventos
-- ---------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid references collaborators(id) on delete cascade,
  event_type_id uuid not null references event_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  status text not null default 'aprobado' check (status in ('aprobado', 'rechazado')),
  note text,
  justification text,
  created_by uuid references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  constraint valid_range check (end_date >= start_date)
);

-- por si ya tenías la tabla de la versión anterior
alter table events add column if not exists justification text;
alter table events add column if not exists created_by uuid references auth.users(id);
alter table events add column if not exists created_by_name text;

create index if not exists idx_events_dates on events using gist (daterange(start_date, end_date, '[]'));
create index if not exists idx_events_collaborator on events(collaborator_id);
create index if not exists idx_events_created_at on events(created_at);

-- ---------------------------------------------------------
-- Regla 1: cobertura de turno
--
-- Aplica a todos los tipos de evento con blocks_coverage = true
-- (todos menos paternidad). Un colaborador puede pedir el permiso
-- siempre y cuando, después de aprobarlo, siga quedando AL MENOS 1
-- colaborador activo de su mismo turno cubriendo esas fechas.
-- ---------------------------------------------------------
create or replace function check_shift_coverage()
returns trigger as $$
declare
  v_shift_id uuid;
  v_activos_en_turno int;
  v_fuera_en_turno int;
  v_blocks boolean;
begin
  if new.status <> 'aprobado' or new.collaborator_id is null then
    return new;
  end if;

  select blocks_coverage into v_blocks from event_types where id = new.event_type_id;
  if v_blocks is not true then
    return new;
  end if;

  select shift_id into v_shift_id from collaborators where id = new.collaborator_id;

  select count(*) into v_activos_en_turno
    from collaborators
    where shift_id = v_shift_id and active = true;

  select count(distinct e.collaborator_id) into v_fuera_en_turno
    from events e
    join collaborators c on c.id = e.collaborator_id
    join event_types et on et.id = e.event_type_id
    where c.shift_id = v_shift_id
      and et.blocks_coverage = true
      and e.status = 'aprobado'
      and e.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(e.start_date, e.end_date, '[]') && daterange(new.start_date, new.end_date, '[]');

  -- +1 porque este nuevo registro también saca a alguien del turno
  if (v_fuera_en_turno + 1) >= v_activos_en_turno then
    raise exception 'No se puede autorizar: el turno se quedaría sin cobertura entre % y %', new.start_date, new.end_date
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_shift_coverage on events;
create trigger trg_check_shift_coverage
  before insert or update on events
  for each row execute function check_shift_coverage();

-- ---------------------------------------------------------
-- Regla 2: días de anticipación mínimos
--
-- Si el tipo de evento requiere anticipación (requires_notice) y
-- la fecha de inicio queda a menos de app_settings.min_notice_days
-- de hoy, exige una justificación en texto plano.
-- ---------------------------------------------------------
create or replace function check_notice_period()
returns trigger as $$
declare
  v_requires_notice boolean;
  v_min_days int;
begin
  select requires_notice into v_requires_notice from event_types where id = new.event_type_id;
  if v_requires_notice is not true then
    return new;
  end if;

  select min_notice_days into v_min_days from app_settings where id = 1;

  if (new.start_date - current_date) < v_min_days
     and (new.justification is null or btrim(new.justification) = '') then
    raise exception 'Este evento se está registrando con menos de % días de anticipación. Agrega una justificación.', v_min_days
      using errcode = 'P0002';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_notice_period on events;
create trigger trg_check_notice_period
  before insert or update on events
  for each row execute function check_notice_period();

-- ---------------------------------------------------------
-- Seguridad de login: control de intentos fallidos
--
-- No se exponen políticas de RLS sobre esta tabla (nadie la lee ni
-- escribe directo); todo pasa por las funciones security definer
-- de abajo, llamadas desde el endpoint de login.
-- ---------------------------------------------------------
create table if not exists login_attempts (
  id bigserial primary key,
  email text not null,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts_email_time on login_attempts(email, created_at);

alter table login_attempts enable row level security;
-- sin policies: acceso solo vía funciones security definer

create or replace function login_attempts_locked(p_email text, p_window_minutes int default 15, p_max_attempts int default 5)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select count(*) >= p_max_attempts
  from login_attempts
  where email = lower(p_email)
    and success = false
    and created_at > now() - (p_window_minutes || ' minutes')::interval;
$$;

create or replace function count_recent_failed_attempts(p_email text, p_window_minutes int default 15)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from login_attempts
  where email = lower(p_email)
    and success = false
    and created_at > now() - (p_window_minutes || ' minutes')::interval;
$$;

create or replace function register_login_attempt(p_email text, p_ip text, p_success boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into login_attempts(email, ip, success) values (lower(p_email), p_ip, p_success);
  if p_success then
    delete from login_attempts where email = lower(p_email) and success = false;
  end if;
end;
$$;

grant execute on function login_attempts_locked(text, int, int) to anon, authenticated;
grant execute on function count_recent_failed_attempts(text, int) to anon, authenticated;
grant execute on function register_login_attempt(text, text, boolean) to anon, authenticated;

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------
alter table shifts enable row level security;
alter table collaborators enable row level security;
alter table event_types enable row level security;
alter table events enable row level security;
alter table profiles enable row level security;
alter table app_settings enable row level security;

-- Lectura pública (para la vista de solo consulta)
drop policy if exists "public read shifts" on shifts;
create policy "public read shifts" on shifts for select using (true);

drop policy if exists "public read collaborators" on collaborators;
create policy "public read collaborators" on collaborators for select using (true);

drop policy if exists "public read event_types" on event_types;
create policy "public read event_types" on event_types for select using (true);

drop policy if exists "public read events" on events;
create policy "public read events" on events for select using (true);

drop policy if exists "public read settings" on app_settings;
create policy "public read settings" on app_settings for select using (true);

-- Escritura: turnos, colaboradores, tipos de evento y ajustes -> solo super_admin
drop policy if exists "admin write shifts" on shifts;
drop policy if exists "super_admin write shifts" on shifts;
create policy "super_admin write shifts" on shifts for all
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists "admin write collaborators" on collaborators;
drop policy if exists "super_admin write collaborators" on collaborators;
create policy "super_admin write collaborators" on collaborators for all
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists "admin write event_types" on event_types;
drop policy if exists "super_admin write event_types" on event_types;
create policy "super_admin write event_types" on event_types for all
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists "super_admin write settings" on app_settings;
create policy "super_admin write settings" on app_settings for all
  using (is_super_admin()) with check (is_super_admin());

-- Eventos: cualquier usuario autenticado (admin o super_admin) puede
-- dar de alta; solo super_admin puede editar/eliminar.
drop policy if exists "admin write events" on events;
drop policy if exists "authenticated insert events" on events;
create policy "authenticated insert events" on events for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "super_admin update events" on events;
create policy "super_admin update events" on events for update
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists "super_admin delete events" on events;
create policy "super_admin delete events" on events for delete
  using (is_super_admin());

-- Perfiles: cada quien ve el suyo; super_admin ve y edita todos
drop policy if exists "self read profile" on profiles;
create policy "self read profile" on profiles for select using (auth.uid() = id);

drop policy if exists "super_admin read all profiles" on profiles;
create policy "super_admin read all profiles" on profiles for select using (is_super_admin());

drop policy if exists "super_admin update profiles" on profiles;
create policy "super_admin update profiles" on profiles for update
  using (is_super_admin()) with check (is_super_admin());
