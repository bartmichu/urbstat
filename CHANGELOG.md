# CHANGELOG

This changelog starts at version `0.10.0` and includes a selection of significant changes.

## Breaking Changes

- 0.15.0
  - Renamed `URBSTAT_THRESHOLD_UNSEEN_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_UNSEEN` and `URBSTAT_THRESHOLD_STALE_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_STALE`.
  - Renamed the `--client` option to `--client-name` in *activities commands to allow for future implementation of `--client-id`.

- 0.14.0
  - Matching stale clients now uses a single common time threshold instead of separate thresholds for files and images. This is specified using the `--threshold` option and the `URBSTAT_THRESHOLD_STALE_CLIENT` configuration option. The previous behavior can still be achieved by combining the `--threshold` option with `--skip-file` and `--skip-image`.
  - Naming change – "void" clients are now referred to as "unseen" clients. As a result, the option name has changed to `--unseen-clients`, and the corresponding configuration option is now `URBSTAT_THRESHOLD_UNSEEN_CLIENT`.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.

## Notable Changes

- 0.15.0
  - Renamed `URBSTAT_THRESHOLD_UNSEEN_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_UNSEEN` and `URBSTAT_THRESHOLD_STALE_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_STALE`.
  - Allow server URL to be set through the `--url` option.
  - Implement `--group-name` option to *client commands.
  - Renamed the `--client` option to `--client-name` in *activities commands to allow for future implementation of `--client-id`.

- 0.14.3
  - Update to `urbackup-server-api@^0.90.0` which uses Node fetch API.

- 0.14.2
  - New commands: `removed-clients`, `outdated-clients`.

- 0.14.0
  - Matching stale clients now uses a single common time threshold instead of separate thresholds for files and images. This is specified using the `--threshold` option and the `URBSTAT_THRESHOLD_STALE_CLIENT` configuration option. The previous behavior can still be achieved by combining the `--threshold` option with `--skip-file` and `--skip-image`.
  - Naming change – "void" clients are now referred to as "unseen" clients. As a result, the option name has changed to `--unseen-clients`, and the corresponding configuration option is now `URBSTAT_THRESHOLD_UNSEEN_CLIENT`.

- 0.11.0
  - Now that deno compile supports npm modules, I switched to using my `urbackup-server-api` Node.js library.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.
