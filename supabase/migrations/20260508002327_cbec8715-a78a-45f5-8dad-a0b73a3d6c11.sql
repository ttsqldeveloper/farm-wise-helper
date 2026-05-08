-- Fix mutable search_path
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Lock down SECURITY DEFINER functions (only triggers should call)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Replace public listing with object-only access (URLs still work since bucket is public)
drop policy if exists "diagnosis_images_public_read" on storage.objects;
-- No SELECT policy needed for public buckets to serve files via public URL.