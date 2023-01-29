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
- Can be executed manually when needed or configured with automated monitoring
  solution like Zabbix
- Get all clients, get clients with "OK" or "failed" backup status (as seen in
  server web UI)
- Get stale clients, that is clients without a recent backup (as configured in
  urbstat)
- Get blank clients, that is clients without any finished backups
- Get void clients, that is clients not seen for a long time (as configured in
  urbstat)
- Get online, offline, active clients
- Get current, last, paused activities

On the roadmap:

- Usage statistics
- Ability to query multiple servers at the same time
- Your suggestion goes here

---

## Usage

On the command line:

```shell
deno run --allow-read='.env,.env.defaults,.env.example' --allow-net=hostname:port --allow-env urbstat.js
```

If you have issues with self-signed certificates then you can use this command:

```shell
deno run --allow-read='.env,.env.defaults,.env.example' --allow-net=hostname:port --allow-env --unsafely-ignore-certificate-errors=hostname urbstat.js
```

---

## Configuration

- Default options are configured in `.env.defaults` file
- You can override default settings in `.env` file
- Most options can also be modified at run time with command options, check
  `urbstat <command> --help` for more details

---

## Documentation

Documentation is accessible via the `--help` option of `urbstat` application.

Get general help and a list of available commands:

```shell
urbstat.js --help
```

Get more help about specific command and applicable options:

```shell
urbstat.js <command> --help
```

---

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

---

## Dependencies

`urbstat` uses some third party modules:

- Cliffy https://cliffy.io
- ms https://github.com/vercel/ms

---

## License

[MIT License](https://github.com/bartmichu/urbstat/blob/main/LICENSE).
