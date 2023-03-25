# URBSTAT

The missing command-line tool for UrBackup Server. It provides valuable insights
into the utilization of data, clients' status and activities, and helps
administrator to identify, troubleshoot and resolve issues that may arise within
the system.

You have the option to use this Deno application in two ways: either as a
self-contained compiled executable or as a script file that runs with Deno.
Although it is not entirely feature-complete, the Main branch is stable and has
been utilized daily on a bunch of servers.

The following features have been implemented:

- Utilizes the standard API provided by UrBackup Server, so there is no need to
  change or install anything on the server.
- You can choose to run the tool directly on the server or remotely over the
  network from your workstation.
- The output can be presented in various formats, and you have the ability to
  sort data and apply filters as needed.
- You can execute the tool manually when required, or you can use it with an
  automated monitoring solution such as Zabbix.
- Information about all clients, including clients with "OK" or "failed" backup
  status (as seen in the server web UI).
- Information about clients without a recent backup (referred to as stale
  clients), with thresholds that can be configured in urbstatus.
- Information about clients without any finished backups (blank clients) and
  clients not seen for a long time (void clients), with a threshold that can be
  configured in urbstat.
- Information about online, offline, and active clients.
- Information about current, last (finished), and paused activities.
- Information about storage usage.
- All information about a selected client can be obtained at once.

Some of the features that are planned for implementation:

- The ability to query multiple servers simultaneously.
- Creating a repository for deb and rpm systems using OBS.

If you have any suggestions for new features that you would like to see in
future updates, please don't hesitate to share them with me. Additionally, if
you encounter any bugs or issues while using the tool, please report them
through GitHub.

## Quick demo

[![asciicast](https://asciinema.org/a/557533.svg)](https://asciinema.org/a/557533)

## Command examples

Retrieve the number of clients with failed image backup:

```shell
get-failed-clients --skip-file --format number
```

Retrieve clients with a file backup that is older than 24 hours (1440 minutes)
since the last backup:

```shell
get-stale-clients --threshold-file 1440 --sort name --format table
```

Retrieve clients that have not been seen for more than 48 hours (2880 minutes):

```shell
get-void-clients --threshold 2880 --sort name --format table
```

Retrieve a list containing the names of clients that have not yet completed any
backup:

```shell
get-blank-clients --format list
```

Retrieve the current activity with the longest estimated time of arrival (ETA).:

```shell
get-current-activities --max 1 --sort eta --reverse --format table
```

Get a table with the last activities of the "office" client sorted by size:

```shell
get-last-activities --limit-client office --sort size --format table
```

Retrieve the five longest running activities that have been completed:

```shell
get-last-activities --max 5 --sort duration --reverse --format table
```

Get three clients with biggest storage usage:

```shell
get-usage --format table --sort total --max 3 --reverse
```

## Usage

The simplest way to use `urbstat` is by downloading the executable from the
[Releases](https://github.com/bartmichu/urbstat/releases) page:

- `urbstat` for Linux x64 systems.
- `urbstat-notls` for Linux x64 systems, compiled with TLS certificate
  validation disabled. Use it only if you have problems with self-signed
  certificates.

Download one of these files and make it executable:

```shell
chmod u+x urbstat
chmod u+x urbstat-notls
```

Create `.env` configuration file (you can use
[this example file](https://raw.githubusercontent.com/bartmichu/urbstat/main/.env.example))
and place it in the same directory with `usbstat` binary. Then simply run the
application:

```shell
./urbstat --help
./urbstat-notls --help
```

Alternatively, you can run source file with Deno:

```shell
deno run --allow-read='.env,.env.defaults,.env.example' --allow-net=hostname:port --allow-env urbstat.js

deno run --allow-read='.env,.env.defaults,.env.example' --allow-net=hostname:port --allow-env --unsafely-ignore-certificate-errors=hostname urbstat.js
```

## Configuration

- The default options are already set up in the .env.defaults file, so please
  avoid modifying it.
- You can set up your own custom options in the .env file, which you can find
  examples of in the .env.example file.
- Many options can also be adjusted during runtime by using command options. For
  more details, please refer to urbstat <command> --help.
- If you're not using the default installation (i.e. localhost:55414, admin, no
  password), you'll need to set at least URBSTAT_SERVER_URL,
  URBSTAT_SERVER_USERNAME, and URBSTAT_SERVER_PASSWORD.
- Make sure to place all configuration files in the same directory as the
  downloaded binary file.

## Documentation

You can access the documentation by using the --help option within the
application.

Get general help and a list of available commands:

```shell
./urbstat --help
```

Get more help about a specific command and its applicable options:

```shell
./urbstat <command> --help
```

## Security considerations

- The `urbstat` tool implements only a subset of the UrBackup server API. It
  does not include methods to modify settings, add or remove clients and groups,
  or start or stop activities.

- Avoid using the `admin` account with `urbstat`. Instead, create a dedicated
  user through the UrBackup Server web UI and apply the principle of least
  privilege to that user. To get full functionality of `urbstat`, you should
  grant the user all rights in the `status`, `lastacts`, `progress`, and
  `piegraph` domains.

- Deno provides granular control over permissions. To restrict what `urbstat`
  can access on your system and network, you should utilize the `allow-read` and
  `allow-net` flags.

- Deno rejects self-signed certificates by default. If needed, you can use the
  `unsafely-ignore-certificate-errors=hostname` option or supply a certificate
  with the `cert ./ca.pem` option.

- Make sure `.env` configuration file has strict file permissions if you put
  your password there.

- `urbstat` binary is compiled with
  `--allow-read='.env,.env.defaults,.env.example' --allow-net --allow-env`
  flags, `urbstat-notls` is compiled with
  `--allow-read='.env,.env.defaults,.env.example' --allow-net --allow-env --unsafely-ignore-certificate-errors`
  flags.

- In some scenarios you may want to download and examine the source script, set
  the connection details within the script, and then compile the script
  manually.

## Dependencies

These third-party modules are utilized by `urbstat`:

- Cliffy https://cliffy.io
- ms https://github.com/vercel/ms

## License

[MIT License](https://github.com/bartmichu/urbstat/blob/main/LICENSE)
