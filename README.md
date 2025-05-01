# URBSTAT

A missing command-line tool for UrBackup Server - finally here. `urbstat` gives you quick insights into data usage, client status, and activities, making it easier to spot problems, troubleshoot, and keep your backups running smoothly.

You can use this Deno-based tool in two ways: either as a precompiled executable or by running the script directly with Deno - whichever works best for you.

What it can do:

- Uses UrBackup Server’s standard API - no need to install anything or change settings on the server.

- Works both locally on the server or remotely from your own machine.

- Output can be customized with different formats, sorting, and filters.

- Run it manually when needed or hook it up with monitoring tools like Zabbix.

- Shows info about all clients - including those with successful or failed backups (just like in the server web UI).

- Detects clients without recent backups (stale clients), with customizable thresholds.

- Identifies clients with no finished backups (blank clients) or those that haven’t been seen in a while (unseen clients), also with configurable thresholds.

- Shows clients using an outdated version of UrBackup.

- Gives you a breakdown of who's online, offline, or actively backing up.

- Lists current, last completed, and paused backup activities.

- Shows storage usage stats.

- Want all the details for a single client? You can get everything in one go.

Some of the features that are planned for implementation in the future:

- The ability to query multiple servers simultaneously.

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

If you'd like to customize the default settings, you can create a `urbstat.conf` configuration file. Use [this example](https://raw.githubusercontent.com/bartmichu/urbstat/main/urbstat.conf.example) as a starting point, and save it in the same directory as the urbstat binary.

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

- The configuration file is optional. If it is not present, hardcoded default values are used.

- You can use [this example file](https://raw.githubusercontent.com/bartmichu/urbstat/main/urbstat.conf.example) as a baseline for your configuration file.

- Ensure the configuration file is named `urbstat.conf` and is located in the same directory as the downloaded binary file.

- If you are not using the default installation (`localhost:55414`, `admin`, no password), you must set `URBSTAT_SERVER_URL`, `URBSTAT_SERVER_USERNAME`, `URBSTAT_SERVER_PASSWORD` in the configuration file. Alternatively, the server URL can be passed using the `--url` option, the username with the `--user` option, and the password can be specified interactively at runtime when the `--ask-pass` option is provided. For details, see: `urbstat --help`.

- Many settings can also be adjusted at runtime through command-line options. For more information, please refer to `urbstat <command> --help`.

- Some defaults are hard-coded as a safety measure in case they are missing from this configuration file. Values provided in the configuration file will override the hard-coded defaults.

- Make sure configuration file has strict file permissions if you put your password in it.

## CHANGELOG

This changelog starts at version `0.10.0` and includes a selection of significant changes.

### Breaking Changes

- 0.15.0
  - Renamed `URBSTAT_THRESHOLD_UNSEEN_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_UNSEEN` and `URBSTAT_THRESHOLD_STALE_CLIENT` to `URBSTAT_CLIENTS_THRESHOLD_STALE`.
  - Renamed the `--client` option to `--client-name` in *activities commands to allow for future implementation of `--client-id`.

- 0.14.0
  - Matching stale clients now uses a single common time threshold instead of separate thresholds for files and images. This is specified using the `--threshold` option and the `URBSTAT_THRESHOLD_STALE_CLIENT` configuration option. The previous behavior can still be achieved by combining the `--threshold` option with `--skip-file` and `--skip-image`.
  - Naming change – "void" clients are now referred to as "unseen" clients. As a result, the option name has changed to `--unseen-clients`, and the corresponding configuration option is now `URBSTAT_THRESHOLD_UNSEEN_CLIENT`.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.

### Notable Changes

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

## Documentation

You can access the documentation by using the `--help` option within the application.

Get general help and a list of available commands:

```shell
./urbstat --help
```

Get more help about a specific command and its applicable options:

```shell
./urbstat <command> --help
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

  Get raw response of "status" API call. Matches all clients, including those marked for removal. Required rights: `status(all)`. Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.

- **raw-activities**

  Get raw response of "activities" API call. Matches all clients, including those marked for removal. Required rights: `progress(all)`, `lastacts(all)`. Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.

- **raw-usage**

  Get raw response of "usage" API call. Matches all clients, including those marked for removal. Required rights: `piegraph(all)`. Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.

- **all-clients**

  Retrieves all clients, including those marked for removal. Required rights: `status(all)`. If you specify "raw" format, the output cannot be sorted or filtered, and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `group-name`.

- **ok-clients**

  Retrieves OK clients, i.e. clients with OK backup status. Excludes clients marked for removal. Backups finished with issues are treated as OK by default. Required rights: `status(all)`. If you specify "raw" format, the output cannot be sorted or filtered, and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `skip-file`, `skip-image`, `strict`, `group-name`.

- **outdated-clients**

  Retrieve clients using an outdated version of UrBackup. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `group-name`.

- **failed-clients**

  Retrieves failed clients, i.e. clients with failed backup status or without a recent backup as configured in UrBackup Server. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `skip-file`, `skip-image`, `skip-blank`, `group-name`.

- **stale-clients**

  Retrieves stale clients, i.e. clients without a recent backup as configured in urbstat. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_STALE`.

  Options: `format`, `sort`, `reverse`, `max`, `threshold`, `skip-file`, `skip-image`, `skip-blank`, `group-name`.

- **blank-clients**

  Retrieves blank clients, i.e. clients without any finished backups. Excludes clients marked for removal. Required rights: status(all). If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `skip-file`, `skip-image`, `group-name`,

- **unseen-clients**

  Retrieves unseen clients, i.e. clients not seen for a long time as configured in urbstat. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_UNSEEN`.

  Options: `format`, `sort`, `reverse`, `max`, `threshold`, `skip-blank`, `group-name`.

- **removed-clients**

  Retrieves clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `group-name`.

- **online-clients**

  Retrieves online clients. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `skip-blank`, `group-name`.

- **offline-clients**

  Retrieves offline clients. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `skip-blank`, `group-name`.

- **active-clients**

  Retrieves currently active clients. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `group-name`.

- **current-activities**

  Retrieves current activities. Required rights: `progress(all)`, `lastacts(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `skip-paused`, `client-name`.

- **last-activities**

  Retrieves last activities. Required rights: `progress(all)`, `lastacts(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `client-name`.

- **paused-activities**

  Retrieves paused activities. Required rights: `progress(all)`, `lastacts(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `client-name`.

- **usage**

  Retrieves storage usage. Required rights: `piegraph(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.

  Default options are configured with: `URBSTAT_USAGE_FORMAT`, `URBSTAT_USAGE_SORT`, `URBSTAT_LOCALE`.

  Options: `format`, `sort`, `reverse`, `max`, `client-name`.

- **client**

  Retrieves all information about one client. Required rights: `status(all)`, `progress(all)`, `lastacts(all)`. If you specify "raw" format then property names/values are left unaltered.

  Default options are configured with: `URBSTAT_CLIENT_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.

  Options: `format`, `id`, `name`.

## Security considerations

- Avoid using the default `admin` account if possible. Instead, create a dedicated user through the UrBackup Server web UI and apply the principle of least privilege to that user. To get full functionality of `urbstat`, you should grant the user all rights in the `status`, `lastacts`, `progress`, and `piegraph` domains.

- Deno provides granular control over permissions. To restrict what `urbstat` can access on your system and network, you can utilize the `allow-read` and `allow-net` flags.

- Deno rejects self-signed certificates by default. If needed, you can use the `unsafely-ignore-certificate-errors=hostname` option or supply a certificate with the `cert ./ca.pem` option.

- You can use `--ask-pass` option if you don't want to put password in a configuration file.

- Make sure configuration file has strict file permissions if you put your password in it.

- `urbstat` binary is compiled with `--allow-read='urbstat.conf' --allow-net --allow-env='NODE_EXTRA_CA_CERTS'` flags.

- In some scenarios you may want to download and examine the source script, set the connection details within the script, and then compile the script manually.

## Dependencies

These first-party modules are utilized by `urbstat`:

- urbackup-server-api <https://github.com/bartmichu/node-urbackup-server-api>

These third-party modules are utilized by `urbstat`:

- Cliffy <https://cliffy.io>
- ms <https://github.com/vercel/ms>

## License

[MIT License](https://github.com/bartmichu/urbstat/blob/main/LICENSE)
