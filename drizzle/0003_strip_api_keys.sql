-- API keys now stay on the device that entered them (src/lib/credentials.ts).
-- Remove the ones older clients synced: the two top-level preference keys,
-- and the per-widget OpenWeather key, including widgets inside stacks.
UPDATE "user_preferences"
SET "data" = "data" - 'unsplashCredential' - 'openWeatherCredential'
WHERE "data" ? 'unsplashCredential' OR "data" ? 'openWeatherCredential';
--> statement-breakpoint
UPDATE "user_widgets"
SET "data" = jsonb_set(
  "data",
  '{widgets}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN jsonb_typeof(w -> 'items') = 'array' THEN jsonb_set(
          w #- '{config,openWeatherKey}',
          '{items}',
          (
            SELECT COALESCE(jsonb_agg(i #- '{config,openWeatherKey}' ORDER BY item_ord), '[]'::jsonb)
            FROM jsonb_array_elements(w -> 'items') WITH ORDINALITY AS items(i, item_ord)
          )
        )
        ELSE w #- '{config,openWeatherKey}'
      END
      ORDER BY widget_ord
    ), '[]'::jsonb)
    FROM jsonb_array_elements("data" -> 'widgets') WITH ORDINALITY AS widgets(w, widget_ord)
  )
)
WHERE jsonb_typeof("data" -> 'widgets') = 'array'
  AND "data"::text LIKE '%openWeatherKey%';
