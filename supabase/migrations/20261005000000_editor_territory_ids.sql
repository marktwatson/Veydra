-- Areas an editor is allowed to work. territory_id stays the home area.
-- Nullable array so existing editors are not locked out before areas are set.
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS territory_id UUID;
ALTER TABLE public.editors ADD COLUMN IF NOT EXISTS territory_ids UUID[] DEFAULT '{}';

-- Seed allowed areas from weddings already assigned to the editor.
UPDATE public.editors e
SET territory_ids = sub.ids,
    territory_id = COALESCE(e.territory_id, sub.ids[1])
FROM (
  SELECT editor_id, array_agg(DISTINCT territory_id) AS ids
  FROM public.weddings
  WHERE editor_id IS NOT NULL AND territory_id IS NOT NULL
  GROUP BY editor_id
) sub
WHERE e.id = sub.editor_id
  AND (e.territory_ids IS NULL OR e.territory_ids = '{}');

NOTIFY pgrst, 'reload schema';
