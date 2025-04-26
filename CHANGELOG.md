# CHANGELOG

This changelog starts at version `0.10.0` and includes a selection of significant changes.

## Breaking Changes

- 0.14.0
  - Matching stale clients now uses a single common time threshold instead of separate thresholds for files and images. This is specified using the `--threshold` option and the `URBSTAT_THRESHOLD_STALE_CLIENT` configuration option. The previous behavior can still be achieved by combining the `--threshold` option with `--skip-file` and `--skip-image`.
  - Naming change – "void" clients are now referred to as "unseen" clients. As a result, the option name has changed to `--unseen-clients`, and the corresponding configuration option is now `URBSTAT_THRESHOLD_UNSEEN_CLIENT`.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.

## Notable Changes

- 0.11.0
  - Now that deno compile supports npm modules, I switched to using my `urbackup-server-api` Node.js library.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.
