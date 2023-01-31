# URBSTAT

The missing command-line tool for UrBackup Server. It provides you with
information about clients status and activities on your server, helps to detect
and diagnose problems.

Implemented features:

- Uses standard API provided by UrBackup Server so you don't have to change or
  install anything on the server
- You can run it directly on the server or remotely over the network from your
  workstation
- Output can be presented in multiple formats, you can sort data and apply
  filters
- Can be executed manually when needed or used with automated monitoring
  solution like Zabbix
- Get all clients, get clients with "OK" or "failed" backup status (as seen in
  server web UI)
- Get clients without a recent backup (stale clients), with thresholds
  configured in urbstatus
- Get clients without any finished backups (blank clients)
- Get clients not seen for a long time (void clients), with threshold configured
  in urbstat
- Get online, offline, active clients
- Get current, last (finished), paused activities

On the roadmap:

- Ability to get usage statistics
- Ability to get detailed report about selected client
- Ability to query multiple servers at the same time
- Repository for deb and rpm systems via OBS
- Your suggestion goes here

This application is in active development. `Main` branch should be stable and is
being used on a daily basis on my servers. `Unstable` branch is where I'm
experimenting and it can be broken at any given time.

Please report bugs and issues via GitHub!

## Command examples

Get the number of clients with failed image backup:

```shell
get-failed-clients --skip-file --format number
```

Get clients with last file backup older than a day (1440 minutes):

```shell
get-stale-clients --threshold-file 1440 --sort name --format table
```

Get clients not seen for more than two days (2880 minutes):

```shell
get-void-clients --threshold 2880 --sort name --format table
```

Get a list with names of clients without any finished backup:

```shell
get-blank-clients --format list
```

Get current activity with the longest ETA:

```shell
get-current-activities --max 1 --sort eta --reverse --format table
```

Get a table with last activities of "office" client, sorted by size:

```shell
get-last-activities --limit-client office --sort size --format table
```

Get five longest running last activities:

```shell
get-last-activities --max 5 --sort duration --reverse --format table
```

## Usage

The easiest way of running `urbstat` is with a downloaded binary file.

Download one of the following binaries from the
[Releases](https://github.com/bartmichu/urbstat/releases) page:

- `urbstat` for Linux x64 systems
- `urbstat-notls` for Linux x64 systems, compiled with TLS certificate
  validation disabled. Use it only if you have problems with self-signed
  certificates

Make it executable:

```shell
chmod u+x urbstat
chmod u+x urbstat-notls
```

Create `.env` configuration file (you can use
[this example file](https://raw.githubusercontent.com/bartmichu/urbstat/main/.env.example)),
place it in the same directory where `usbstat` binary is stored, and simply run
application:

```shell
./urbstat --help
./urbstat-notls --help
```

If you want, you can also directly run source file with Deno:

```shell
deno run --allow-read='.env,.env.defaults,.env.example' --allow-net=hostname:port --allow-env urbstat.js

deno run --allow-read='.env,.env.defaults,.env.example' --allow-net=hostname:port --allow-env --unsafely-ignore-certificate-errors=hostname urbstat.js
```

## Configuration

- Default options are configured in `.env.defaults` file, do not modify that
  file
- Set your custom options in `.env` file, check `.env.example` for available
  options
- Most options can also be modified at run time with command options, check
  `urbstat <command> --help` for more details
- Unless it is a default installation (localhost:55414, admin, no password), you
  should set at least `URBSTAT_SERVER_URL`, `URBSTAT_SERVER_USERNAME` and
  `URBSTAT_SERVER_PASSWORD`
- All configuration files should be placed in the same directory as downloaded
  binary file

## Documentation

Documentation is accessible via the `--help` option of `urbstat` application.

Get general help and a list of available commands:

```shell
./urbstat --help
```

Get more help about specific command and applicable options:

```shell
./urbstat <command> --help
```

## Security considerations

- Only a subset of server API is implemented in `urbstat`. In particular, there
  is no methods to modify settings, add or remove clients and groups, start or
  stop activities

- Don't use `admin` account for `urbstat`. Create a dedicated user with UrBackup
  Server web UI and apply least privilege principle to that user. To get full
  functionality of `urbstat` you should set `all` rights in `status`,
  `lastacts`, `progress` and `piegraph` domains

- Deno gives you granural control over permissions. You should make use of
  `allow-read` and `allow-net` flags to restrict what `urbstat` can access on
  your system and network

- Deno rejects self-signed certificates. You can use
  `unsafely-ignore-certificate-errors=hostname` option or supply certificate
  with `cert ./ca.pem` option if needed

- Make sure `.env` configuration file has strict file permissions if you put
  your password there

- `urbstat` binary is compiled with
  `--allow-read='.env,.env.defaults,.env.example' --allow-net --allow-env`
  flags, `urbstat-notls` is compiled with
  `--allow-read='.env,.env.defaults,.env.example' --allow-net --allow-env --unsafely-ignore-certificate-errors`
  flags

## Dependencies

`urbstat` uses some third party modules:

- Cliffy https://cliffy.io
- ms https://github.com/vercel/ms

## License

[MIT License](https://github.com/bartmichu/urbstat/blob/main/LICENSE)
