# FinanzApp · Configurar la nube (Supabase)

Esto activa las **cuentas con email y contraseña** y el respaldo entre dispositivos.
La base de datos es opcional: con o sin conexión, cada cambio se guarda primero en
el dispositivo y la app sigue funcionando localmente.

## 1. Crear el proyecto
1. Entrá a https://supabase.com → **Start your project** (gratis).
2. **New project** → ponele un nombre (ej. `finanzapp`), una contraseña de base de datos (guardala) y una región cercana (ej. South America).
3. Esperá ~2 minutos a que se cree.

## 2. Crear la tabla (correr el SQL)
En el proyecto: menú izquierdo → **SQL Editor** → **New query** → pegá esto y dale **Run**:

```sql
-- Una fila por usuario con todo el estado de la app en JSON.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seguridad: cada usuario solo puede ver/editar su propia fila.
alter table public.user_data enable row level security;

drop policy if exists "own row select" on public.user_data;
create policy "own row select" on public.user_data
  for select using (auth.uid() = user_id);
drop policy if exists "own row insert" on public.user_data;
create policy "own row insert" on public.user_data
  for insert with check (auth.uid() = user_id);
drop policy if exists "own row update" on public.user_data;
create policy "own row update" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- El servidor, no el reloj del teléfono, fecha cada actualización.
create or replace function public.set_user_data_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_data_set_updated_at on public.user_data;
create trigger user_data_set_updated_at
before insert or update on public.user_data
for each row execute function public.set_user_data_updated_at();
```

## 3. Configurar el acceso
1. Menú izquierdo → **Authentication** → **URL Configuration**.
2. En **Site URL** poné la dirección donde corrés la app (ej. `https://tu-app.vercel.app` o la URL que uses).
3. En **Redirect URLs** agregá esa misma URL (y cualquier otra donde la abras).
4. En **Authentication → Providers → Email**, dejá habilitado Email. Podés exigir
   confirmación por correo o desactivarla durante pruebas.

## 4. Pasarme las 2 claves
Menú izquierdo → **Project Settings** → **API**:
- **Project URL** (ej. `https://abcd1234.supabase.co`)
- **anon public** key (la `anon`, NO la `service_role`)

Pegámelas en el chat y yo las cargo en la app. La `anon` es pública y segura de incluir: lo que protege los datos es el **Row Level Security** de arriba (cada uno solo ve lo suyo).

## Cómo va a funcionar
- **Sin cuenta:** la app sigue local, igual que ahora.
- **Crear cuenta / entrar:** Más → **Mi cuenta** → ponés tu email → te llega un link → entrás.
- **Primer login:** si ya tenías datos locales, se **suben** a tu cuenta automáticamente.
- **Otro dispositivo:** entrás con el mismo email y te bajan tus datos.
- **Cambios:** se guardan inmediatamente en el dispositivo y después se suben.
- **Sin internet:** la app sigue funcionando y deja señalada la subida pendiente.
- **Dos dispositivos modificados offline:** la app no pisa ninguno; te deja elegir
  explícitamente entre la versión local y la versión de la nube.
