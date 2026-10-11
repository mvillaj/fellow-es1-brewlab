-- Built-in grinder corrections reach grinders already on someone's bench.
--
-- A grinder row copies its spec's scale, calibration and notes when it is
-- added, so fixing BUILT_IN_GRINDERS only helps grinders added afterwards.
-- This brings existing rows across for the specs that changed:
--
-- - Fellow Opus 2 was modelled as the original Opus (41 clicks, 40 mm burrs).
--   The real grinder has a stepless side dial marked 0-10.
-- - The 1Zpresso J-Ultra, J-Max, JX-Pro and K-Ultra used the manufacturer's
--   burr travel per click as particle size, and their dials stopped short of
--   where espresso is actually pulled.
--
-- Only rows still holding the exact old built-in values move. A grinder that
-- was recalibrated or edited by hand keeps what its owner gave it: those
-- numbers were chosen against the old scale, and guessing what they meant is
-- worse than leaving them.
--
-- Shots are not touched. Each keeps the setting and micron value it was logged
-- with, which is the rule everywhere else.

-- Fellow Opus 2
UPDATE grinders
SET scale       = '{"kind":"stepless","min":0,"max":10,"step":0.1,"unitLabel":"dial"}',
    calibration = '{"umPerUnit":100,"interceptUm":200,"source":"estimated"}',
    notes = CASE
      WHEN notes = 'Same 41-step dial as the original Opus, tightened burr alignment. Calibration here is an estimate — worth dialling in with the two-point calibrator.'
      THEN 'Not the original Opus dial: a stepless side dial marked 0-10, with new 48 mm burrs. Fellow puts most espresso around 0-2. Calibrate it if you convert filter settings.'
      ELSE notes
    END
WHERE built_in_id = 'fellow-opus-2'
  AND json_extract(scale, '$.kind') = 'clicks'
  AND json_extract(scale, '$.max') = 41
  AND json_extract(calibration, '$.umPerUnit') = 28
  AND json_extract(calibration, '$.interceptUm') = 150
  AND json_extract(calibration, '$.source') = 'estimated';

-- 1Zpresso J-Ultra
UPDATE grinders
SET scale       = '{"kind":"clicks","min":0,"max":500,"step":1,"unitLabel":"clicks"}',
    calibration = '{"umPerUnit":2.5,"interceptUm":15,"source":"community"}',
    notes = CASE
      WHEN notes = '8.0 µm per click, 30 clicks per rotation. Published by 1Zpresso.'
      THEN '100 clicks per rotation, 5 rotations. 1Zpresso publishes 8 µm of burr travel per click; that is burr movement, not particle size. Espresso range from the Honest Coffee Guide chart.'
      ELSE notes
    END
WHERE built_in_id = '1zpresso-j-ultra'
  AND json_extract(scale, '$.max') = 120
  AND json_extract(calibration, '$.umPerUnit') = 8
  AND json_extract(calibration, '$.interceptUm') = 0
  AND json_extract(calibration, '$.source') = 'measured';

-- 1Zpresso J-Max
UPDATE grinders
SET scale       = '{"kind":"clicks","min":0,"max":405,"step":1,"unitLabel":"clicks"}',
    calibration = '{"umPerUnit":2.7,"interceptUm":14,"source":"community"}',
    notes = CASE
      WHEN notes = '8.8 µm per click, 90 clicks per rotation. Espresso-first hand grinder.'
      THEN '90 clicks per rotation, 4.5 rotations. 1Zpresso publishes 8.8 µm of burr travel per click. Espresso range from the Honest Coffee Guide chart.'
      ELSE notes
    END
WHERE built_in_id = '1zpresso-j-max'
  AND json_extract(scale, '$.max') = 90
  AND json_extract(calibration, '$.umPerUnit') = 8.8
  AND json_extract(calibration, '$.interceptUm') = 0
  AND json_extract(calibration, '$.source') = 'measured';

-- 1Zpresso JX-Pro (the dial was right; only the line changes)
UPDATE grinders
SET calibration = '{"umPerUnit":4.65,"interceptUm":14,"source":"community"}',
    notes = COALESCE(notes, '40 clicks per rotation. 1Zpresso publishes 12.5 µm of burr travel per click. Espresso range from the Honest Coffee Guide chart; other guides disagree, so calibrate.')
WHERE built_in_id = '1zpresso-jx-pro'
  AND json_extract(calibration, '$.umPerUnit') = 12.5
  AND json_extract(calibration, '$.interceptUm') = 0
  AND json_extract(calibration, '$.source') = 'measured';

-- 1Zpresso K-Ultra (the dial was right; only the line changes)
UPDATE grinders
SET calibration = '{"umPerUnit":8,"interceptUm":8,"source":"community"}',
    notes = COALESCE(notes, '100 clicks per rotation. 1Zpresso publishes 20 µm of burr travel per click. Espresso range from the Honest Coffee Guide chart.')
WHERE built_in_id = '1zpresso-k-ultra'
  AND json_extract(calibration, '$.umPerUnit') = 12.5
  AND json_extract(calibration, '$.interceptUm') = 0
  AND json_extract(calibration, '$.source') = 'measured';
