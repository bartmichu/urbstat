# URBSTAT

The essential command-line tool for UrBackup Server. `urbstat` provides quick insights into data usage, client status, and activities, making it easier to spot problems, troubleshoot, and keep your backups running smoothly.

You can use this Deno-based tool in two ways: either as a precompiled executable or by running the script directly with Deno - whichever works best for you.

What it can do:

- Uses UrBackup Server’s standard API - no need to install anything or change settings on the server.

- Works both locally on the server or remotely from your own machine.

- Output can be customized with different formats, sorting, and filters.

- Run it manually when needed or integrate it with monitoring tools like Zabbix.

- Shows info about all clients - including those with successful or failed backups (just like in the server web UI).

- Detects clients without recent backups (stale clients), with customizable thresholds.

- Identifies clients with no finished backups (blank clients) or those that haven’t been seen in a while (unseen clients), each with configurable thresholds.

- Shows clients using an outdated version of UrBackup.

- Provides a breakdown of which clients are online, offline, or actively backing up.

- Lists current, last completed, and paused backup activities.

- Shows storage usage stats.

- Delivers comprehensive details for a single client in one command.

Planned Features:

- Querying multiple servers simultaneously.

Got a feature idea? Found a bug? Feel free to open an issue or suggestion on GitHub - feedback is always welcome!

## Quick demo

[![asciicast](https://asciinema.org/a/557533.svg)](https://asciinema.org/a/557533)

Please keep in mind that this demo may represent an older version of `urbstat` with different command names and options.

## Command examples

The examples are detailed and show multiple options with their values. In practice, you can set these values as defaults in the configuration file to make the commands much shorter.

Retrieve the number of clients with failed image backup:

```shell
failed-clients --skip-file
failed-clients --skip-file --format number --ask-pass
failed-clients --skip-file --format list --user urbstat
```

Retrieve clients with a file backup that is older than 24 hours (1440 minutes) since the last backup:

```shell
stale-clients --threshold 1440 --skip-image --sort name --format table
```

Retrieve clients that have not been seen for more than 48 hours (2880 minutes):

```shell
unseen-clients --threshold 2880 --sort name --format table
```

Retrieve a list containing the names of clients that have not yet completed any backup:

```shell
blank-clients --format list
```

Retrieve the current activity with the longest estimated time of arrival (ETA).:

```shell
current-activities --max 1 --sort eta --reverse --format table
```

Get a table with the last activities of the "office" client sorted by size:

```shell
last-activities --client-name office --sort size --format table
```

Retrieve the five longest running activities that have been completed:

```shell
last-activities --max 5 --sort duration --reverse --format table
```

Get three clients with biggest storage usage:

```shell
usage --format table --sort total --max 3 --reverse
```

## Usage

### Precompiled binary

The easiest way to get started with `urbstat` is by downloading the executable from the [Releases](https://github.com/bartmichu/urbstat/releases) page. After downloading, make the file executable:

```shell
chmod u+x urbstat
```

If you'd like to customize the default settings, you can create a `urbstat.conf` configuration file. Use [this example](https://raw.githubusercontent.com/bartmichu/urbstat/main/urbstat.conf.example) as a starting point, and save it in the same directory as the urbstat executable.

Once everything is set up, just run the application:

```shell
./urbstat --help
```

### Running with Deno

Alternatively, instead of using the precompiled binary, you can install Deno and run the source file directly. You'll need to grant it permissions to read the configuration file and access the network (`--allow-read='urbstat.conf'`, `--allow-net`):

```shell
deno run --allow-read='urbstat.conf' --allow-net urbstat.js
```

Or, if you need to bypass certificate verification:

```shell
deno run --allow-read='urbstat.conf' --allow-net --unsafely-ignore-certificate-errors urbstat.js
```

## Configuration

- The configuration file is optional. If not present, hardcoded default values are used.

- You can use [this example file](https://raw.githubusercontent.com/bartmichu/urbstat/main/urbstat.conf.example) as a baseline for your configuration file.

- Ensure the configuration file is named `urbstat.conf` and is located in the same directory as the `urbstat` executable.

- If you are not using the default server connection details (`localhost:55414`, `admin`, no password), set `URBSTAT_SERVER_URL`, `URBSTAT_SERVER_USERNAME`, and `URBSTAT_SERVER_PASSWORD` in the configuration file. Alternatively, specify the server URL with the `--url` option, the username with `--user`, and enter the password interactively at runtime using the `--ask-pass` option. For more details, run `urbstat --help`.

- Many settings can also be adjusted at runtime through command-line options. For more information, refer to `urbstat <command> --help`.

- Some defaults are hard-coded as a safety measure if missing from the configuration file. Values provided in the configuration file will override these hard-coded defaults.

- Ensure the configuration file has strict file permissions if you store your password in it.

## CHANGELOG

This changelog starts at version `0.10.0` and includes a selection of significant changes.

### Breaking Changes

- 0.15.0
  - Renamed `URBSTAT_THRESHOLD_UNSEEN_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_UNSEEN` and `URBSTAT_THRESHOLD_STALE_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_STALE`.
  - Renamed the `--client` option to `--client-name` in *activities commands to allow for implementation of `--client-id`.

- 0.14.0
  - Matching stale clients now uses a single common time threshold instead of separate thresholds for files and images. This is specified using the `--threshold` option and the `URBSTAT_THRESHOLD_STALE_CLIENT` configuration option. The previous behavior can still be achieved by combining the `--threshold` option with `--skip-file` and `--skip-image`.
  - Naming change – "void" clients are now referred to as "unseen" clients. As a result, the option name has changed to `--unseen-clients`, and the corresponding configuration option is now `URBSTAT_THRESHOLD_UNSEEN_CLIENT`.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.

### Notable Changes

- 0.17.0
  - Major rewrite, code optimisations.
  - Allow sorting with `--sort` option for `raw` output format.
  - Alow limiting with `--max` option for `raw` output format.
  - Removed `npm:ms` dependency.
  - Implement the `users` command to retrieve a list of users, and add the `URBSTAT_USERS_SORT` and `URBSTAT_USERS_FORMAT` settings.
  - Implement the `groups` command to retrieve a list of groups, and add the `URBSTAT_GROUPS_SORT` and `URBSTAT_GROUPS_FORMAT` settings.

- 0.15.0
  - Renamed `URBSTAT_THRESHOLD_UNSEEN_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_UNSEEN` and `URBSTAT_THRESHOLD_STALE_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_STALE`.
  - Allow server URL to be set through the `--url` option.
  - Implement `--group-name` option to *client commands.
  - Renamed the `--client` option to `--client-name` in *activities commands to allow for implementation of `--client-id`.
  - Implement `--client-id` option to *activities commands.

- 0.14.3
  - Update to `urbackup-server-api@^0.90.0` which uses Node fetch API.

- 0.14.2
  - New commands: `removed-clients`, `outdated-clients`.

- 0.14.0
  - Matching stale clients now uses a single common time threshold instead of separate thresholds for files and images. This is specified using the `--threshold` option and the `URBSTAT_THRESHOLD_STALE_CLIENT` configuration option. The previous behavior can still be achieved by combining the `--threshold` option with `--skip-file` and `--skip-image`.
  - Naming change: "void" clients are now referred to as "unseen" clients. As a result, the option name has changed to `--unseen-clients`, and the corresponding configuration option is now `URBSTAT_THRESHOLD_UNSEEN_CLIENT`.

- 0.11.0
  - Now that deno compile supports npm modules, I switched to using my `urbackup-server-api` Node.js library.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.

## Documentation

Access the built-in documentation using the `--help` option.

Get general help and a list of available commands:

```shell
./urbstat --help
```

Get more help about a specific command and its applicable options:

```shell
./urbstat <command> --help
./urbstat failed-clients --help
```

### Global Options

```bash
-h, --help             - Show this help.
-V, --version          - Show the version number for this program.
--url          <url>   - Server URL.
--user         <name>  - User name.
--ask-pass             - Ask for connection password.
```

### Commands

- **raw-status**

  Gets the raw JSON response of the 'status' API call. Matches all clients, including those marked for removal.

  Required rights: `status(all)`.

  Raw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.

- **raw-activities**

  Gets the raw JSON response of the 'activities' API call. Matches all clients, including those marked for removal.

  Required rights: `progress(all)`, `lastacts(all)`.

  Raw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.

- **raw-usage**

  Gets the raw JSON response of the 'usage' API cal. Matches all clients, including those marked for removal.

  Required rights: `piegraph(all)`.

  Raw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.

- **all-clients**

  Retrieves all clients, including those marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--group-name`.

- **ok-clients**

  Retrieves clients with an 'OK' backup status. Excludes clients marked for removal. Backups finished with issues are treated as OK by default.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--skip-file`, `--skip-image`, `--strict`, `--group-name`.

- **outdated-clients**

  Retrieves clients running an outdated version of the UrBackup client software. Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--group-name`.

- **failed-clients**

  Retrieves clients with a 'failed' backup status or those without a recent backup (as per UrBackup Server settings). Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--skip-file`, `--skip-image`, `--skip-blank`, `--group-name`.

- **stale-clients**

  Retrieves 'stale' clients, i.e., clients without a recent backup according to the `urbstat` configured threshold. Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_STALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--threshold`, `--skip-file`, `--skip-image`, `--skip-blank`, `--group-name`.

- **blank-clients**

  Retrieves 'blank' clients, i.e., clients that have no completed backups. Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--skip-file`, `--skip-image`, `--group-name`,

- **unseen-clients**

  Retrieves 'unseen' clients, i.e., clients not seen by the server for a duration exceeding the `urbstat` configured threshold. Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_UNSEEN`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--threshold`, `--skip-blank`, `--group-name`.

- **removed-clients**

  Retrieves clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--group-name`.

- **online-clients**

  Retrieves online clients. Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--skip-blank`, `--group-name`.

- **offline-clients**

  Retrieves offline clients. Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--skip-blank`, `--group-name`.

- **active-clients**

  Retrieves currently active clients. Excludes clients marked for removal.

  Required rights: `status(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--group-name`.

- **current-activities**

  Retrieves current activities.

  Required rights: `progress(all)`, `lastacts(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--skip-paused`, `--client-name`, `--client-id`.

- **last-activities**

  Retrieves recently completed activities.

  Required rights: `progress(all)`, `lastacts(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--client-name`, `--client-id`.

- **paused-activities**

  Retrieves paused activities.

  Required rights: `progress(all)`, `lastacts(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--client-name`, `--client-id`.

- **usage**

  Retrieves storage usage statistics for clients.

  Required rights: `piegraph(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_USAGE_FORMAT`, `URBSTAT_USAGE_SORT`, `URBSTAT_LOCALE`.

  Options: `--format`, `--sort`, `--reverse`, `--max`, `--client-name`.

- **client**

  Retrieves comprehensive information for a single client, including status, activities, and usage.

  Required rights: `status(all)`, `progress(all)`, `lastacts(all)`.

  If the 'raw' format is specified, property names and values are returned as-is. Sorting and filtering are not applied to raw output for sub-sections.

  Default options are configured using: `URBSTAT_CLIENT_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.

  Options: `--format`, `--id`, `--name`.

- **users**

  Retrieves all users.

  Required rights: `usermod(all)`, `settings(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.

  Default options are configured using: `URBSTAT_USERS_SORT`, `URBSTAT_USERS_FORMAT`.

  Options: `--format`, `--sort`, `--reverse`, `--max`.

- **groups**

  Retrieves all groups. By default, UrBackup clients are added to a group with ID 0 and an empty name (empty string).

  Required rights: `settings(all)`.

  If the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_GROUPS_SORT`, `URBSTAT_GROUPS_FORMAT`.

  Options: `--format`, `--sort`, `--reverse`, `--max`.

## Security considerations

- Avoid using the default `admin` account if possible. Instead, create a dedicated user through the UrBackup Server web UI and apply the principle of least privilege. For full `urbstat` functionality, grant this user all rights in the `status`, `lastacts`, `progress`, `piegraph`, `settings`, `usermod` domains.

- Deno provides granular control over permissions. To restrict what `urbstat` can access on your system and network, you can utilize the `allow-read` and `allow-net` flags.

- Deno rejects self-signed certificates by default. If needed, you can use the `--unsafely-ignore-certificate-errors=hostname` option or supply a certificate with the `--cert ./ca.pem` option.

- You can use the `--ask-pass` option if you prefer not to store your password in a configuration file.

- Ensure the configuration file has strict file permissions if you store your password in it.

- `urbstat` binary is compiled with `--allow-read='urbstat.conf' --allow-net --allow-env='NODE_EXTRA_CA_CERTS'` flags.

- In some scenarios, you might prefer to download and examine the source script, then compile it manually. This allows for direct modification if needed, though embedding connection details directly into the script should be done with caution and awareness of the security implications.

## Dependencies

These first-party modules are utilized by `urbstat`:

- urbackup-server-api <https://github.com/bartmichu/node-urbackup-server-api>

These third-party modules are utilized by `urbstat`:

- Cliffy <https://cliffy.io>

## License

[MIT License](https://github.com/bartmichu/urbstat/blob/main/LICENSE)
