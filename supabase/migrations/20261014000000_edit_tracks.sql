-- Optional photo/video editor split. Unused until a wedding is explicitly split.
alter table public.weddings
  add column if not exists edit_split boolean not null default false,
  add column if not exists photo_editor_id text,
  add column if not exists photo_editing_status text,
  add column if not exists video_editor_id text,
  add column if not exists video_editing_status text,
  add column if not exists photo_invoice_status text,
  add column if not exists photo_invoice_details jsonb,
  add column if not exists photo_payout_amount numeric,
  add column if not exists video_invoice_status text,
  add column if not exists video_invoice_details jsonb,
  add column if not exists video_payout_amount numeric;
