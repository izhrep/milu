-- Run backfill to create snapshots for all completed/inactive stages that are missing snapshots
SELECT backfill_diagnostic_snapshots();