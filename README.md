# URBSTAT

The missing command-line tool for UrBackup Server. It provides valuable insights into the utilization of data, clients' status and activities, and helps administrator to identify, troubleshoot and resolve issues that may arise within the system.

You have the option to use this Deno application in two ways: either as a self-contained compiled executable or as a script file that runs with Deno.

The following features have been implemented:

- Utilizes the standard API provided by UrBackup Server, so there is no need to change or install anything on the server.

- You can choose to run the tool directly on the server or remotely over the network from your workstation.

- The output can be presented in various formats, and you have the ability to sort data and apply filters as needed.

- You can execute the tool manually when required, or you can use it with an automated monitoring solution such as Zabbix.

- Information about all clients, including clients with "OK" or "failed" backup status (as seen in the server web UI).

- Information about clients without a recent backup (referred to as stale clients), with threshold that can be configured.

- Information about clients without any finished backups (blank clients) and clients not seen for a long time (unseen clients), with a threshold that can be configured.

- Information about online, offline, and active clients.

- Information about current, last (finished), and paused activities.

- Information about storage usage.

- All information about a selected client can be obtained at once.

Some of the features that are planned for implementation in the future:

- The ability to query multiple servers simultaneously.

If you have any suggestions for new features that you would like to see in future updates, please don't hesitate to share them with me. Additionally, if you encounter any bugs or issues while using the tool, please report them through GitHub.

## Quick demo

[![asciicast](https://asciinema.org/a/557533.svg)](https://asciinema.org/a/557533)

Please keep in mind that this demo may represent an older version of `urbstat` with different command names and options.

## Command examples

The examples are detailed and show multiple options with their values. In practice, you can set these values as defaults in the configuration file to make the commands much shorter.

Retrieve the number of clients with failed image backup:

```shell
failed-clients --skip-file --format number
failed-clients --skip-file --format number --ask-pass
failed-clients --skip-file --format number --user urbstat
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
last-activities --client office --sort size --format table
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

The simplest way to use `urbstat` is by downloading the executable from the [Releases](https://github.com/bartmichu/urbstat/releases) page.

Download this file and make it executable:

```shell
chmod u+x urbstat
```

Create `urbstat.conf` configuration file (you can use [this example file](https://raw.githubusercontent.com/bartmichu/urbstat/main/urbstat.conf.example) as a baseline) and place it in the same directory with `usbstat` binary. Then simply run the application:

```shell
./urbstat --help
```

Alternatively, you can run source file with Deno:

```shell
deno run --allow-read='urbstat.conf' --allow-net=hostname:port --allow-env='NODE_EXTRA_CA_CERTS' urbstat.js

deno run --allow-read='urbstat.conf' --allow-net=hostname:port --unsafely-ignore-certificate-errors=hostname urbstat.js
```

## Configuration

- You can use [this example file](https://raw.githubusercontent.com/bartmichu/urbstat/main/urbstat.conf.example) as a baseline for your configuration file.

- Ensure the configuration file is named `urbstat.conf` and is located in the same directory as the downloaded binary file.

- If you are not using the default installation (`localhost:55414`, `admin`, no password), you must set `URBSTAT_SERVER_URL`, `URBSTAT_SERVER_USERNAME`, `URBSTAT_SERVER_PASSWORD` in the configuration file. Alternatively, username can be passed with `--user` option and password can be specified interactively at runtime when `--ask-pass` option is provided. For details, see: `urbstat --help`.

- Many settings can also be adjusted at runtime through command-line options. For more information, please refer to `urbstat <command> --help`.

- Some defaults are hard-coded as a safety measure in case they are missing from this configuration file. Values provided in the configuration file will override the hard-coded defaults.

- Make sure configuration file has strict file permissions if you put your password in it.

## CHANGELOG

This changelog starts at version `0.10.0` and includes a selection of significant changes.

### Breaking Changes

- 0.14.0
  - Matching stale clients now uses a single common time threshold instead of separate thresholds for files and images. This is specified using the `--threshold` option and the `URBSTAT_THRESHOLD_STALE_CLIENT` configuration option. The previous behavior can still be achieved by combining the `--threshold` option with `--skip-file` and `--skip-image`.
  - Naming change – "void" clients are now referred to as "unseen" clients. As a result, the option name has changed to `--unseen-clients`, and the corresponding configuration option is now `URBSTAT_THRESHOLD_UNSEEN_CLIENT`.

- 0.10.0
  - The configuration file name has been changed from `.env` to `urbstat.conf`.

### Notable Changes

- 0.14.3
  - Update to `urbackup-server-api@^0.90.0` which uses Node fetch API.

- 0.14.2
  - New commands: `removed-clients`, `outdated-clients`.

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

  Retrieves all clients, including those marked for removal. Required rights: `status(all)`. If you specify "raw" format, the output cannot be sorted or filtered, and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **ok-clients**

  Retrieves OK clients, i.e. clients with OK backup status. Excludes clients marked for removal. Backups finished with issues are treated as OK by default. Required rights: `status(all)`. If you specify "raw" format, the output cannot be sorted or filtered, and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **outdated-clients**

  Retrieve clients using an outdated version of UrBackup. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **failed-clients**

  Retrieves failed clients, i.e. clients with failed backup status or without a recent backup as configured in UrBackup Server. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **stale-clients**

  Retrieves stale clients, i.e. clients without a recent backup as configured in urbstat. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_THRESHOLD_STALE_CLIENT`.

- **blank-clients**

  Retrieves blank clients, i.e. clients without any finished backups. Excludes clients marked for removal. Required rights: status(all). If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.'

- **unseen-clients**

  Retrieves unseen clients, i.e. clients not seen for a long time as configured in urbstat. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_THRESHOLD_unseen_CLIENT`.

- **removed-clients**

  Retrieves clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **online-clients**

  Retrieves online clients. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **offline-clients**

  Retrieves offline clients. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **active-clients**

  Retrieves currently active clients. Excludes clients marked for removal. Required rights: `status(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.

- **current-activities**

  Retrieves current activities. Required rights: `progress(all)`, `lastacts(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.

- **last-activities**

  Retrieves last activities. Required rights: `progress(all)`, `lastacts(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.

- **paused-activities**

  Retrieves paused activities. Required rights: `progress(all)`, `lastacts(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.

- **usage**

  Retrieves storage usage. Required rights: `piegraph(all)`. If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: `URBSTAT_USAGE_FORMAT`, `URBSTAT_USAGE_SORT`, `URBSTAT_LOCALE`.

- **client**

  Retrieves all information about one client. Required rights: `status(all)`, `progress(all)`, `lastacts(all)`. If you specify "raw" format then property names/values are left unaltered. Default options are configured with: `URBSTAT_CLIENT_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.

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
