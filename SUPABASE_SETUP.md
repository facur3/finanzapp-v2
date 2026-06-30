# FinanzApp · Configurar la nube (Supabase)

Esto activa las **cuentas con login por email (magic link)** y la **sincronización**.
Mientras no se configure, la app funciona 100% local (como hasta ahora).

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

create policy "own row select" on public.user_data
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 3. Configurar el email / redirect
1. Menú izquierdo → **Authentication** → **URL Configuration**.
2. En **Site URL** poné la dirección donde corrés la app (ej. `https://tu-app.vercel.app` o la URL que uses).
3. En **Redirect URLs** agregá esa misma URL (y cualquier otra donde la abras).
   - El magic link solo redirige a URLs de esta lista.

> El proveedor de email por defecto de Supabase sirve para probar (pocos mails/hora).
> Para producción conviene conectar un SMTP propio en **Authentication → Emails**, pero para empezar no hace falta.

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
- **Cambios:** se guardan solos en la nube cada vez que tocás algo.
