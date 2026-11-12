-- Run this on its own, after migration-003-shorter-readme.sql has finished.
-- It gives the freed space back (the table is locked for a minute or two).
vacuum full public.entries;
