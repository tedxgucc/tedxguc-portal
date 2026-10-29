-- Allow the existing announcement edit policy to cover the optional photo.
grant update (image_url) on public.announcements to authenticated;
