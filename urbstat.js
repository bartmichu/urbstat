import { colors } from '@cliffy/ansi/colors';
import { Command, EnumType } from '@cliffy/command';
import { load } from '@std/dotenv';
import { Secret } from '@cliffy/prompt';
import { Table } from '@cliffy/table';
import { UrbackupServer } from 'urbackup-server-api';
import ms from 'ms';

/**
 * Hard-coded configuration values used as a fallback when not found in config file.
 */
const configFallback = {
  URBSTAT_ACTIVITIES_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'number', 'raw'] },
  URBSTAT_ACTIVITIES_SORT_CURRENT: { defaultValue: 'client', acceptedValues: ['client', 'eta', 'progress', 'size'] },
  URBSTAT_ACTIVITIES_SORT_LAST: { defaultValue: 'time', acceptedValues: ['client', 'time', 'duration', 'size'] },
  URBSTAT_CLIENT_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'raw'] },
  URBSTAT_CLIENTS_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'list', 'number', 'raw'] },
  URBSTAT_CLIENTS_SORT: { defaultValue: 'name', acceptedValues: ['name', 'seen', 'file', 'image'] },
  URBSTAT_CLIENTS_THRESHOLD_STALE: { defaultValue: 7200 },
  URBSTAT_CLIENTS_THRESHOLD_UNSEEN: { defaultValue: 10080 },
  URBSTAT_LOCALE: { defaultValue: 'en' },
  URBSTAT_SERVER_PASSWORD: { defaultValue: '' },
  URBSTAT_SERVER_URL: { defaultValue: 'http://127.0.0.1:55414' },
  URBSTAT_SERVER_USERNAME: { defaultValue: 'admin' },
  URBSTAT_USAGE_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'raw'] },
  URBSTAT_USAGE_SORT: { defaultValue: 'total', acceptedValues: ['name', 'file', 'image', 'total'] },
};

/**
 * Common font and style definitions.
 */
const cliTheme = { error: colors.bold.red, warning: colors.yellow, information: colors.blue };

/**
 * Configuration data loaded from the configuration file.
 */
const configData = await load({ envPath: './urbstat.conf', export: false });

// TODO: convert to iife?
/**
 * Get the configuration value for the specified key.
 * @param {string} key - The configuration key.
 * @returns {*} The configuration value.
 */
const getConfigValue = function (key) {
  if (key in configFallback) {
    return configData[key] ?? configFallback[key].defaultValue;
  } else {
    return null;
  }
};

/**
 * The status response from the server.
 */
let statusResponse;

/**
 * The activities response from the server.
 */
let activitiesResponse;

/**
 * The paused activities response from the server.
 */
let pausedActivitiesResponse;

/**
 * The usage response from the server.
 */
let usageResponse;

/**
 * The all-clients response from the server.
 */
let allClientsResponse;

/**
 * The ok-clients response from the server.
 */
let okClientsResponse;

/**
 * The outdated-clients response from the server.
 */
let outdatedClientsResponse;

/**
 * The failed-clients response from the server.
 */
let failedClientsResponse;

/**
 * The stale-clients response from the server.
 */
let staleClientsResponse;

/**
 * The blank-clients response from the server.
 */
let blankClientsResponse;

/**
 * The unseen-clients response from the server.
 */
let unseenClientsResponse;

/**
 * The removed-clients response from the server.
 */
let removedClientsResponse;

/**
 * The online-clients response from the server.
 */
let onlineClientsResponse;

/**
 * The offline-clients response from the server.
 */
let offlineClientsResponse;

/**
 * The active-clients response from the server.
 */
let activeClientsResponse;

/**
 * Make the required API calls to the UrBackup Server.
 * @param {string[]} requiredCalls - The required API calls.
 * @param {Object} commandOptions - The command options.
 * @returns {Promise<void>}
 */
async function makeServerCalls(requiredCalls, commandOptions) {
  const url = commandOptions?.url?.length > 0 ? commandOptions.url : getConfigValue('URBSTAT_SERVER_URL');
  const username = commandOptions?.user?.length > 0 ? commandOptions.user : getConfigValue('URBSTAT_SERVER_USERNAME');
  const password = commandOptions?.askPass === true ? await Secret.prompt('Enter password') : getConfigValue('URBSTAT_SERVER_PASSWORD');

  const server = new UrbackupServer({
    url: url,
    username: username,
    password: password,
  });

  try {
    statusResponse = requiredCalls.includes('status')
      ? await server.getStatus({
        clientId: typeof commandOptions?.id === 'number' ? commandOptions.id : undefined,
        clientName: commandOptions?.name?.length > 0 ? commandOptions.name : undefined,
        includeRemoved: true,
      })
      : null;

    activitiesResponse = requiredCalls.includes('activities')
      ? await server.getActivities({
        clientId: typeof commandOptions?.clientId === 'number' ? commandOptions.clientId : undefined,
        clientName: commandOptions?.clientName?.length > 0 ? commandOptions.clientName : undefined,
        includeCurrent: true,
        includeLast: true,
        includePaused: commandOptions?.skipPaused !== true,
      })
      : null;

    pausedActivitiesResponse = requiredCalls.includes('paused-activities')
      ? await server.getPausedActivities({
        clientId: typeof commandOptions?.clientId === 'number' ? commandOptions.clientId : undefined,
        clientName: commandOptions?.clientName?.length > 0 ? commandOptions.clientName : undefined,
      })
      : null;

    usageResponse = requiredCalls.includes('usage')
      ? await server.getUsage({
        clientName: commandOptions?.clientName?.length > 0 ? commandOptions.clientName : undefined,
      })
      : null;

    allClientsResponse = requiredCalls.includes('all-clients')
      ? await server.getClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: true,
      })
      : null;

    okClientsResponse = requiredCalls.includes('ok-clients')
      ? await server.getOkClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
        failOnFileIssues: commandOptions?.strict === true,
      })
      : null;

    outdatedClientsResponse = requiredCalls.includes('outdated-clients')
      ? await server.getOutdatedClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
      })
      : null;

    failedClientsResponse = requiredCalls.includes('failed-clients')
      ? await server.getFailedClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
        failOnFileIssues: commandOptions?.strict === true,
      })
      : null;

    staleClientsResponse = requiredCalls.includes('stale-clients')
      ? await server.getStaleClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
        timeThreshold: commandOptions?.threshold >= 0 ? commandOptions.threshold : 0,
      })
      : null;

    blankClientsResponse = requiredCalls.includes('blank-clients')
      ? await server.getBlankClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
      })
      : null;

    unseenClientsResponse = requiredCalls.includes('unseen-clients')
      ? await server.getUnseenClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
        timeThreshold: commandOptions?.threshold >= 0 ? commandOptions.threshold : 0,
      })
      : null;

    removedClientsResponse = requiredCalls.includes('removed-clients') ? await server.getRemovedClients() : null;

    onlineClientsResponse = requiredCalls.includes('online-clients')
      ? await server.getOnlineClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
      })
      : null;

    offlineClientsResponse = requiredCalls.includes('offline-clients')
      ? await server.getOfflineClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
      })
      : null;

    activeClientsResponse = requiredCalls.includes('active-clients')
      ? await server.getActiveClients({
        // TODO: Workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
      })
      : null;
  } catch (e) {
    // deno-lint-ignore no-console
    console.error(cliTheme.error(e.message));
    Deno.exit(1);
  }
}

/**
 * Normalize client object for further use in the application.
 * @param {Object} client - The client object to normalize.
 * @param {string} format - The format to normalize the client object.
 * @returns {Object} The normalized client object.
 */
const normalizeClient = function (client, format) {
  if (format === 'raw') {
    return client;
  } else {
    return (function (
      {
        id,
        name,
        file_ok,
        file_disabled,
        last_filebackup_issues,
        lastbackup,
        image_ok,
        image_disabled,
        lastbackup_image,
        online,
        lastseen,
        status,
      },
    ) {
      if (file_disabled === true) {
        file_ok = 'disabled';
      } else if (file_ok === true) {
        file_ok = last_filebackup_issues === 0 ? 'ok' : 'issues';
      } else {
        file_ok = 'failed';
      }

      if (image_disabled === true) {
        image_ok = 'disabled';
      } else if (image_ok === true) {
        image_ok = 'ok';
      } else {
        image_ok = 'failed';
      }

      return ({
        'Client Id': id,
        'Client Name': name,
        'File BUP Status': file_ok,
        'Last File BUP': lastbackup,
        'Image BUP Status': image_ok,
        'Last Image BUP': lastbackup_image,
        Online: online === true ? 'yes' : 'no',
        'Last Seen': lastseen,
        Activity: status,
      });
    })(client);
  }
};

/**
 * Normalize activity object for further use in the application.
 * @param {Object} activity - The activity object to normalize.
 * @param {boolean} last - Flag indicating if it's the last activity.
 * @param {string} format - The format to normalize the activity object.
 * @returns {Object} The normalized activity object.
 */
const normalizeActivity = function (activity, last, format) {
  if (format === 'raw') {
    return activity;
  }

  if (last === true) {
    return (function ({ clientid, name, id, duration, size_bytes, backuptime }) {
      return ({
        'Activity Id': id,
        'Client Id': clientid,
        'Client Name': name,
        Duration: duration,
        Size: activity.del === true ? size_bytes * -1 : size_bytes,
        'Starting Time': backuptime,
      });
    })(activity);
  } else {
    return (function ({ clientid, name, action, paused, pcdone, queue, done_bytes, total_bytes, eta_ms }) {
      return ({
        'Client Id': clientid,
        'Client Name': name,
        Action: action,
        Paused: paused === true ? 'yes' : 'no',
        Progress: pcdone,
        Queue: queue,
        // TODO:
        'Bytes Done': activity.del === true ? done_bytes * -1 : done_bytes,
        Size: total_bytes,
        ETA: eta_ms,
      });
    })(activity);
  }
};

/**
 * Normalize usage object for further use in the application.
 * @param {Object} element - The usage object to normalize.
 * @param {string} format - The format to normalize the usage object.
 * @returns {Object} The normalized usage object.
 */
const normalizeUsage = function (element, format) {
  if (format === 'raw') {
    return element;
  } else {
    return (function ({ files, images, name, used }) {
      return ({
        'Client Name': name,
        'File Backups': files,
        'Image Backups': images,
        'Total': used,
      });
    })(element);
  }
};

/**
 * Sort clients. This function sorts the elements of an array in place.
 * NOTE: Sorting must be done after normalization.
 * @param {Array} clients - The array of client objects to sort.
 * @param {string} format - The format used for normalization.
 * @param {string} order - The sorting order (name, seen, file, image).
 * @param {boolean} reverse - Flag indicating whether to sort in reverse order.
 */
const sortClients = function (clients, format, order, reverse) {
  switch (order) {
    case 'name':
      clients.sort((a, b) => a['Client Name'].localeCompare(b['Client Name'], getConfigValue('URBSTAT_LOCALE'), { sensitivity: 'base' }));
      break;
    case 'seen':
      clients.sort((a, b) => a['Last Seen'] - b['Last Seen']);
      break;
    case 'file':
      clients.sort((a, b) => a['Last File BUP'] - b['Last File BUP']);
      break;
    case 'image':
      clients.sort((a, b) => a['Last Image BUP'] - b['Last Image BUP']);
      break;
  }

  if (reverse === true && format !== 'number') {
    clients.reverse();
  }
};

/**
 * Sort activities. This function sorts the elements of an array in place.
 * NOTE: Sorting must be done after normalization.
 * @param {Array} activities - The array of activity objects to sort.
 * @param {string} format - The format used for normalization.
 * @param {string} order - The sorting order (eta, progress, size, client, time, duration).
 * @param {boolean} reverse - Flag indicating whether to sort in reverse order.
 */
const sortActivities = function (activities, format, order, reverse) {
  switch (order) {
    case 'eta':
      activities.sort((a, b) => a.ETA - b.ETA);
      break;
    case 'progress':
      activities.sort((a, b) => a.Progress - b.Progress);
      break;
    case 'size':
      activities.sort((a, b) => a.Size - b.Size);
      break;
    case 'client':
      activities.sort((a, b) => a['Client Name'].localeCompare(b['Client Name'], getConfigValue('URBSTAT_LOCALE'), { sensitivity: 'base' }));
      break;
    case 'time':
      activities.sort((a, b) => a['Starting Time'] - b['Starting Time']);
      break;
    case 'duration':
      activities.sort((a, b) => a.Duration - b.Duration);
      break;
  }

  if (reverse === true && format !== 'number') {
    activities.reverse();
  }
};

/**
 * Sort usage. This function sorts the elements of an array in place.
 * NOTE: Sorting must be done after normalization.
 * @param {Array} usages - The array of usage objects to sort.
 * @param {string} format - The format used for normalization.
 * @param {string} order - The sorting order (name, file, image, total).
 * @param {boolean} reverse - Flag indicating whether to sort in reverse order.
 */
const sortUsage = function (usages, format, order, reverse) {
  switch (order) {
    case 'name':
      usages.sort((a, b) => a['Client Name'].localeCompare(b['Client Name'], getConfigValue('URBSTAT_LOCALE'), { sensitivity: 'base' }));
      break;
    case 'file':
      usages.sort((a, b) => a['File Backups'] - b['File Backups']);
      break;
    case 'image':
      usages.sort((a, b) => a['Image Backups'] - b['Image Backups']);
      break;
    case 'total':
      usages.sort((a, b) => a.Total - b.Total);
      break;
  }

  if (reverse === true && format !== 'number') {
    usages.reverse();
  }
};

/**
 * Print output based on the specified format.
 * @param {Array} data - The data to print.
 * @param {string} format - The output format (table, list, number, raw).
 */
const printOutput = function (data, format) {
  /**
   * Format bytes to human-readable string.
   * @param {number} bytes - The number of bytes.
   * @param {number} [decimals=2] - The number of decimal places to round to.
   * @returns {string} The formatted string.
   */
  const formatBytes = function (bytes, decimals = 2) {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const kilo = 1024;
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const unitIndex = Math.floor(Math.log(Math.abs(bytes)) / Math.log(kilo));

    return parseFloat((bytes / Math.pow(kilo, unitIndex)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + units[unitIndex];
  };

  // TODO: || 'raw'?
  if (format !== 'number') {
    for (const element in data) {
      if (Object.hasOwn(data, element)) {
        Object.keys(data[element]).forEach(function (key) {
          switch (key) {
            case 'Bytes Done':
            /* falls through */
            case 'File Backups':
            /* falls through */
            case 'Image Backups':
            /* falls through */
            case 'Total':
            /* falls through */
            case 'Size':
              data[element][key] = formatBytes(data[element][key], 2);
              break;
            case 'Duration':
              data[element][key] = ms(data[element][key] * 1000);
              break;
            case 'ETA':
              data[element][key] = data[element][key] <= 0 ? 'n/a' : ms(data[element][key]);
              break;
            case 'Starting Time':
            /* falls through */
            case 'Last File BUP':
            /* falls through */
            case 'Last Image BUP':
            /* falls through */
            case 'Last Seen':
              if (data[element][key] === 0) {
                data[element][key] = 'never';
              } else {
                data[element][key] = new Date(data[element][key] * 1000).toLocaleString(getConfigValue('URBSTAT_LOCALE'));
              }
              break;
            case 'Activity':
              if (data[element][key] === 0) {
                data[element][key] = 'none';
              }
              break;
            case 'Progress':
              data[element][key] = `${data[element][key]}%`;
              break;
          }
        });
      }
    }
  }

  switch (format) {
    case 'table':
      if (data.length > 0) {
        const table = new Table().padding(2).border(true).maxColWidth(11);
        table.header(Object.keys(data[0]));
        for (const element of data) {
          table.push(Object.values(element));
        }
        table.render();
      }
      break;
    case 'list':
      if (data.length > 0) {
        // deno-lint-ignore no-console
        console.info(data);
      }
      break;
    case 'number':
      // deno-lint-ignore no-console
      console.info(data.length);
      break;
    case 'raw':
      // deno-lint-ignore no-console
      console.info(data);
      break;
  }
};

/**
 * Process matching data i.e. normalize, sort and limit. This function changes elements of an array in place.
 *
 * @param {Array} data - The array of data to be processed.
 * @param {string} type - The type of data to be processed.
 * @param {object} commandOptions - The options for the command.
 */
const processMatchingData = function (data, type, commandOptions) {
  data.forEach((element, index) => {
    switch (type) {
      case 'clients':
        data[index] = normalizeClient(element, commandOptions?.format);
        break;
      case 'currentActivities':
        data[index] = normalizeActivity(element, false, commandOptions?.format);
        break;
      case 'pausedActivities':
        data[index] = normalizeActivity(element, false, commandOptions?.format);
        break;
      case 'lastActivities':
        data[index] = normalizeActivity(element, true, commandOptions?.format);
        break;
      case 'usage':
        data[index] = normalizeUsage(element, commandOptions?.format);
        break;
      default:
        break;
    }
  });

  if (commandOptions.format !== 'raw') {
    switch (type) {
      case 'clients':
        sortClients(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
        break;
      case 'currentActivities':
        sortActivities(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
        break;
      case 'lastActivities':
        sortActivities(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
        break;
      case 'usage':
        sortUsage(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
        break;
      default:
        break;
    }
  }

  data.splice(commandOptions?.max > 0 ? commandOptions.max : data.length);

  data.forEach((element, index) => {
    if (type === 'clients') {
      switch (commandOptions?.format) {
        case 'list':
        /* falls through */
        case 'number':
          data[index] = element['Client Name'];
          break;
      }
    }

    if (type === 'currentActivities' || type === 'lastActivities') {
      switch (commandOptions?.format) {
        case 'number':
          data[index] = element['Activity Id'];
          break;
      }
    }

    if (type === 'usage') {
      switch (commandOptions?.format) {
        case 'list':
          data[index] = element['Client Name'];
          break;
      }
    }
  });
};

/**
 * Main command.
 */
const cli = await new Command()
  .name('urbstat')
  .version('0.15.0')
  .description('The Missing Command-line Tool for UrBackup Server.\nDefault options like server address and password are set in the urbstat.conf configuration file.')
  .example('Get failed clients, use password from configuration file', 'urbstat failed-clients')
  .example('Get failed clients, ask for password', 'urbstat failed-clients --ask-pass')
  .example('Get options and detailed help for specific command', 'urbstat failed-clients --help')
  .globalType('activitiesFormatValues', new EnumType(configFallback.URBSTAT_ACTIVITIES_FORMAT.acceptedValues))
  .globalType('clientFormatValues', new EnumType(configFallback.URBSTAT_CLIENT_FORMAT.acceptedValues))
  .globalType('clientsFormatValues', new EnumType(configFallback.URBSTAT_CLIENTS_FORMAT.acceptedValues))
  .globalType('clientsSortValues', new EnumType(configFallback.URBSTAT_CLIENTS_SORT.acceptedValues))
  .globalType('currentActivitiesSortValues', new EnumType(configFallback.URBSTAT_ACTIVITIES_SORT_CURRENT.acceptedValues))
  .globalType('lastActivitiesSortValues', new EnumType(configFallback.URBSTAT_ACTIVITIES_SORT_LAST.acceptedValues))
  .globalType('usageFormatValues', new EnumType(configFallback.URBSTAT_USAGE_FORMAT.acceptedValues))
  .globalType('usageSortValues', new EnumType(configFallback.URBSTAT_USAGE_SORT.acceptedValues))
  .globalOption('--url <url:string>', 'Server URL.')
  .globalOption('--user <name:string>', 'User name.')
  .globalOption('--ask-pass', 'Ask for connection password.')
  .action(() => {
    cli.showHelp();
    Deno.exit(0);
  });

/**
 * Get raw response of "status" API call. Matches all clients, including those marked for removal.
 * Required rights: status(all).
 * Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.
 */
cli.command(
  'raw-status',
  'Get raw response of "status" API call. Matches all clients, including those marked for removal.\nRequired rights: status(all).\nRaw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.',
)
  .example('Get raw response', 'raw-status')
  .action(() => {
    makeServerCalls(['status']).then(() => {
      printOutput(statusResponse, 'raw');
    });
  });

/**
 * Get raw response of "activities" API call. Matches all clients, including those marked for removal.
 * Required rights: progress(all), lastacts(all).
 * Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.
 */
cli.command(
  'raw-activities',
  'Get raw response of "activities" API call. Matches all clients, including those marked for removal.\nRequired rights: progress(all), lastacts(all).\nRaw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.',
)
  .example('Get raw response', 'raw-activities')
  .action(() => {
    makeServerCalls(['activities']).then(() => {
      printOutput(activitiesResponse, 'raw');
    });
  });

/**
 * Get raw response of "usage" API call. Matches all clients, including those marked for removal.
 * Required rights: piegraph(all).
 * Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.
 */
cli.command(
  'raw-usage',
  'Get raw response of "usage" API call. Matches all clients, including those marked for removal.\nRequired rights: piegraph(all).\nRaw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.',
)
  .example('Get raw response', 'raw-usage')
  .action(() => {
    makeServerCalls(['usage']).then(() => {
      printOutput(usageResponse, 'raw');
    });
  });

/**
 * Retrieves all clients, including those marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format, the output cannot be sorted or filtered,
 * and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'all-clients',
  'Retrieves all clients, including those marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format, the output cannot be sorted or filtered, and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get all clients, use default options', 'all-clients')
  .example('Get the total number of all clients', 'all-clients --format "number"')
  .example('Get a sorted table', 'all-clients --format "table" --sort "file"')
  .example('Get reversed list', 'all-clients --format "list" --sort "name" --reverse')
  .example('Get names of three of the longest-unseen clients', 'all-clients --format "list" --sort "seen" --max 3')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['all-clients'], commandOptions).then(() => {
      processMatchingData(allClientsResponse, 'clients', commandOptions);
      printOutput(allClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves OK clients, i.e. clients with OK backup status. Excludes clients marked for removal.
 * Backups finished with issues are treated as OK by default.
 * Required rights: status(all).
 * If you specify "raw" format, the output cannot be sorted or filtered,
 * and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli
  .command(
    'ok-clients',
    'Retrieves OK clients, i.e. clients with OK backup status. Excludes clients marked for removal.\nBackups finished with issues are treated as OK by default.\nRequired rights: status(all).\nIf you specify "raw" format, the output cannot be sorted or filtered, and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
  )
  .example('Get OK clients, use default options', 'ok-clients')
  .example('Get the total number of OK clients', 'ok-clients --format "number"')
  .example('Get a sorted table', 'ok-clients --format "table" --sort "file"')
  .example('Get a sorted table, skip file backup problems', 'ok-clients --format "table" --sort "image" --skip-file')
  .example('Get reversed list', 'ok-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--strict', 'Do not treat backups finished with issues as being OK.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['ok-clients'], commandOptions).then(() => {
      processMatchingData(okClientsResponse, 'clients', commandOptions);
      printOutput(okClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieve clients using an outdated version of UrBackup. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'outdated-clients',
  'Retrieve clients using an outdated version of UrBackup. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get outdated clients, use default options', 'outdated-clients')
  .example('Get the total number of outdated clients', 'outdated-clients --format "number"')
  .example('Get a sorted table', 'outdated-clients --format "table" --sort "name"')
  .example('Get reversed list', 'outdated-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['outdated-clients'], commandOptions).then(() => {
      processMatchingData(outdatedClientsResponse, 'clients', commandOptions);
      printOutput(outdatedClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves failed clients, i.e. clients with failed backup status or without a recent backup as configured in UrBackup Server.
 * Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'failed-clients',
  'Retrieves failed clients, i.e. clients with failed backup status or without a recent backup as configured in UrBackup Server. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get failed clients, use default options', 'failed-clients')
  .example('Get the total number of failed clients', 'failed-clients --format "number"')
  .example('Get a sorted table', 'failed-clients --format "table" --sort "file"')
  .example('Get a sorted table, skip file backup problems', 'failed-clients --format "table" --sort "image" --skip-file')
  .example('Get reversed list', 'failed-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['failed-clients'], commandOptions).then(() => {
      processMatchingData(failedClientsResponse, 'clients', commandOptions);
      printOutput(failedClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves stale clients, i.e. clients without a recent backup as configured in urbstat. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output cannot be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_CLIENTS_THRESHOLD_STALE.
 */
cli.command(
  'stale-clients',
  'Retrieves stale clients, i.e. clients without a recent backup as configured in urbstat. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_CLIENTS_THRESHOLD_STALE.',
)
  .example('Get stale clients, use default options', 'stale-clients')
  .example('Get the total number of stale clients', 'stale-clients --format "number"')
  .example('Get a sorted table', 'stale-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip blank clients', 'stale-clients --format "table" --sort "name" --skip-blank')
  .example('Get a sorted table, skip file backups', 'stale-clients --format "table" --sort "image" --skip-file')
  .example('Get reversed list', 'stale-clients --format "list" --sort "name" --reverse')
  .example('Get clients with file backup older than a day', 'stale-clients --format "table" --sort "name" --threshold 1440 --skip-image')
  .example('Get number of clients with image backup older than 12hrs', 'stale-clients --format "number" --threshold 720 --skip-file')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', { default: getConfigValue('URBSTAT_CLIENTS_THRESHOLD_STALE') })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['stale-clients'], commandOptions).then(() => {
      processMatchingData(staleClientsResponse, 'clients', commandOptions);
      printOutput(staleClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves blank clients, i.e. clients without any finished backups. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'blank-clients',
  'Retrieves blank clients i.e. clients without any finished backups. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get blank clients, use default options', 'blank-clients')
  .example('Get the total number of blank clients', 'blank-clients --format "number"')
  .example('Get a sorted table', 'blank-clients --format "table" --sort "seen"')
  .example('Get a sorted table, skip image backups', 'blank-clients --format "table" --sort "name" --skip-image')
  .example('Get reversed list', 'blank-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['blank-clients'], commandOptions).then(() => {
      processMatchingData(blankClientsResponse, 'clients', commandOptions);
      printOutput(blankClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves unseen clients, i.e. clients not seen for a long time as configured in urbstat. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_CLIENTS_THRESHOLD_UNSEEN.
 */
cli
  .command(
    'unseen-clients',
    'Retrieves unseen clients, i.e. clients not seen for a long time as configured in urbstat. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_CLIENTS_THRESHOLD_UNSEEN.',
  )
  .example('Get unseen clients, use default options', 'unseen-clients')
  .example('Get the total number of unseen clients', 'unseen-clients --format "number"')
  .example('Get a sorted table', 'unseen-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip blank clients', 'unseen-clients --format "table" --sort "seen" --skip-blank')
  .example('Get reversed list', 'unseen-clients --format "list" --sort "name" --reverse')
  .example('Get clients not seen for more than 2 days', 'unseen-clients --format "table" --sort "name" --threshold 2880')
  .example('Get number of clients not seen for more than 12hrs', 'unseen-clients --format "number" --threshold 720')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', { default: getConfigValue('URBSTAT_CLIENTS_THRESHOLD_UNSEEN') })
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['unseen-clients'], commandOptions).then(() => {
      processMatchingData(unseenClientsResponse, 'clients', commandOptions);
      printOutput(unseenClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'removed-clients',
  'Retrieves clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get removed clients, use default options', 'removed-clients')
  .example('Get the total number of removed clients', 'removed-clients --format "number"')
  .example('Get a sorted table', 'removed-clients --format "table" --sort "name"')
  .example('Get reversed list', 'removed-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['removed-clients'], commandOptions).then(() => {
      processMatchingData(removedClientsResponse, 'clients', commandOptions);
      printOutput(removedClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves online clients. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'online-clients',
  'Retrieves online clients. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get online clients, use default options', 'online-clients')
  .example('Get the total number of online clients', 'online-clients --format "number"')
  .example('Get a sorted table', 'online-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip blank clients', 'online-clients --format "table" --sort "name" --skip-blank')
  .example('Get reversed list', 'online-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['online-clients'], commandOptions).then(() => {
      processMatchingData(onlineClientsResponse, 'clients', commandOptions);
      printOutput(onlineClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves offline clients. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'offline-clients',
  'Retrieves offline clients. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get offline clients, use default options', 'offline-clients')
  .example('Get the total number of offline clients', 'offline-clients --format "number"')
  .example('Get a sorted table', 'offline-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip blank clients', 'offline-clients --format "table" --sort "name" --skip-blank')
  .example('Get reversed list', 'offline-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['offline-clients'], commandOptions).then(() => {
      processMatchingData(offlineClientsResponse, 'clients', commandOptions);
      printOutput(offlineClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves currently active clients. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'active-clients',
  'Retrieves currently active clients. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get active clients, use default options', 'active-clients')
  .example('Get the total number of active clients', 'active-clients --format "number"')
  .example('Get a sorted table', 'active-clients --format "table" --sort "name"')
  .example('Get reversed list', 'active-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['active-clients'], commandOptions).then(() => {
      processMatchingData(activeClientsResponse, 'clients', commandOptions);
      printOutput(activeClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves current activities.
 * Required rights: progress(all), lastacts(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_ACTIVITIES_FORMAT, URBSTAT_ACTIVITIES_SORT_CURRENT, URBSTAT_LOCALE.
 */
cli.command(
  'current-activities',
  'Retrieves current activities.\nRequired rights: progress(all), lastacts(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_ACTIVITIES_FORMAT, URBSTAT_ACTIVITIES_SORT_CURRENT, URBSTAT_LOCALE.',
)
  .example('Get CURRENT activities, use default options', 'current-activities')
  .example('Get the total number of CURRENT activities', 'current-activities --format "number"')
  .example('Get a sorted table', 'current-activities --format "table" --sort "progress"')
  .example('Get a sorted table, skip paused activities', 'current-activities --format "table" --sort "progress" --skip-paused')
  .example('Get three activities with longest ETA', 'current-activities --format "table" --sort "eta" --max 3 --reverse')
  .example('Get CURRENT activities of selected client', 'current-activities --format "table" --sort "eta" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:currentActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_ACTIVITIES_SORT_CURRENT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format. ")
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', { default: 0 })
  .option('--skip-paused', 'Skip paused activities.')
  .option('--client-name <name:string>', 'Limit activities to specified client only.')
  .option('--client-id <Id:integer>', 'Limit activities to specified client only.', { conflicts: ['client-name'] })
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
      processMatchingData(activitiesResponse.current, 'currentActivities', commandOptions);
      printOutput(activitiesResponse.current, commandOptions?.format);
    });
  });

/**
 * Retrieves last activities.
 * Required rights: progress(all), lastacts(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_ACTIVITIES_FORMAT, URBSTAT_ACTIVITIES_SORT_LAST, URBSTAT_LOCALE.
 */
cli.command(
  'last-activities',
  'Retrieves last activities.\nRequired rights: progress(all), lastacts(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_ACTIVITIES_FORMAT, URBSTAT_ACTIVITIES_SORT_LAST, URBSTAT_LOCALE.',
)
  .example('Get LAST activities, use default options', 'last-activities')
  .example('Get the total number of LAST activities', 'last-activities --format "number"')
  .example('Get a sorted table', 'last-activities --format "table" --sort "progress"')
  .example('Get three activities with biggest size', 'last-activities --format "table" --sort "size" --max 3 --reverse')
  .example('Get three longest activities', 'last-activities --format "table" --sort "duration" --max 3 --reverse')
  .example('Get LAST activities of selected client', 'last-activities --format "table" --sort "time" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:lastActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_ACTIVITIES_SORT_LAST') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', { default: 0 })
  .option('--client-name <name:string>', 'Limit activities to specified client only.')
  .option('--client-id <Id:integer>', 'Limit activities to specified client only.', { conflicts: ['client-name'] })
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
      processMatchingData(activitiesResponse.last, 'lastActivities', commandOptions);
      printOutput(activitiesResponse.last, commandOptions?.format);
    });
  });

/**
 * Retrieves paused activities.
 * Required rights: progress(all), lastacts(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_ACTIVITIES_FORMAT, URBSTAT_ACTIVITIES_SORT_CURRENT, URBSTAT_LOCALE.
 */
cli.command(
  'paused-activities',
  'Retrieves paused activities.\nRequired rights: progress(all), lastacts(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_ACTIVITIES_FORMAT, URBSTAT_ACTIVITIES_SORT_CURRENT, URBSTAT_LOCALE.',
)
  .example('Get paused activities, use default options', 'paused-activities')
  .example('Get the total number of paused activities', 'paused-activities --format "number"')
  .example('Get a sorted table', 'paused-activities --format "table" --sort "progress"')
  .example('Get 3 activities with biggest size', 'paused-activities --format "table" --sort "size" --max 3 --reverse')
  .example('Get paused activities of a client', 'paused-activities --format "table" --sort "time" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:currentActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_ACTIVITIES_SORT_CURRENT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', { default: 0 })
  .option('--client-name <name:string>', 'Limit activities to specified client only.')
  .option('--client-id <Id:integer>', 'Limit activities to specified client only.', { conflicts: ['client-name'] })
  .action((commandOptions) => {
    makeServerCalls(['paused-activities'], commandOptions).then(() => {
      processMatchingData(pausedActivitiesResponse, 'pausedActivities', commandOptions);
      printOutput(pausedActivitiesResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves storage usage.
 * Required rights: piegraph(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_USAGE_FORMAT, URBSTAT_USAGE_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'usage',
  'Retrieves storage usage.\nRequired rights: piegraph(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_USAGE_FORMAT, URBSTAT_USAGE_SORT, URBSTAT_LOCALE.',
)
  .example('Get storage usage, use default options', 'usage')
  .example('Get a sorted table', 'usage --format "table" --sort "name"')
  .example('Get three clients with biggest usage', 'usage --format "table" --sort "total" --max 3 --reverse')
  .example('Get storage usage of selected client', 'usage --format "table" --client-name "office"')
  .option('--format <format:usageFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_USAGE_FORMAT') })
  .option('--sort <field:usageSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getConfigValue('URBSTAT_USAGE_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--client-name <name:string>', 'Limit usage to specified client only.', { default: '' })
  .action((commandOptions) => {
    makeServerCalls(['usage'], commandOptions).then(() => {
      processMatchingData(usageResponse, 'usage', commandOptions);
      printOutput(usageResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves all information about one client.
 * Required rights: status(all), progress(all), lastacts(all).
 * If you specify "raw" format then property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENT_FORMAT, URBSTAT_ACTIVITIES_SORT_CURRENT, URBSTAT_ACTIVITIES_SORT_LAST, URBSTAT_LOCALE.
 */
cli.command(
  'client',
  'Retrieves all information about one client.\nRequired rights: status(all), progress(all), lastacts(all).\nIf you specify "raw" format then property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENT_FORMAT, URBSTAT_ACTIVITIES_SORT_CURRENT, URBSTAT_ACTIVITIES_SORT_LAST, URBSTAT_LOCALE.',
)
  .example('Get all info about "office" client', 'client --name "office"')
  .option('--format <format:clientFormatValues>', 'Change the output format.', { default: getConfigValue('URBSTAT_CLIENT_FORMAT') })
  .option('--id <Id:integer>', "Client's Id Number.", { conflicts: ['name'] })
  .option('--name <name:string>', "Client's Name.")
  .action(function (commandOptions) {
    // NOTE: don't use arrow function for this action (need access to this)
    if (commandOptions?.id > 0 || commandOptions?.name?.length > 0) {
      makeServerCalls(['status', 'activities', 'usage'], commandOptions).then(
        () => {
          const matchingClient = [];
          matchingClient.push(statusResponse[0]);

          if (typeof matchingClient[0] !== 'undefined' && matchingClient[0]?.id > 0) {
            const matchingClientId = matchingClient[0].id;
            const matchingCurrentActivities = activitiesResponse.current.filter((activity) => activity.clientid === matchingClientId);
            const matchingLastActivities = activitiesResponse.last.filter((activity) => activity.clientid === matchingClientId);
            const matchingUsage = [];
            matchingUsage.push(usageResponse.find((element) => element.name === matchingClient[0].name));

            // deno-lint-ignore no-console
            console.info('Status:');
            processMatchingData(matchingClient, 'clients', commandOptions);
            printOutput(matchingClient, commandOptions?.format);

            // deno-lint-ignore no-console
            console.info('Current activities:');
            processMatchingData(matchingCurrentActivities, 'currentActivities', commandOptions);
            if (matchingCurrentActivities.length > 0) {
              printOutput(matchingCurrentActivities, commandOptions?.format);
            } else {
              if (commandOptions?.format !== 'raw') {
                // deno-lint-ignore no-console
                console.info('none');
              }
            }

            // deno-lint-ignore no-console
            console.info('Last activities:');
            processMatchingData(matchingLastActivities, 'lastActivities', commandOptions);
            if (matchingLastActivities.length > 0) {
              printOutput(matchingLastActivities, commandOptions?.format);
            } else {
              // deno-lint-ignore no-console
              console.info('none');
            }

            // deno-lint-ignore no-console
            console.info('Usage:');
            processMatchingData(matchingUsage, 'usage', commandOptions);
            printOutput(matchingUsage, commandOptions?.format);
          } else {
            // deno-lint-ignore no-console
            console.warn(cliTheme.warning('Client not found'));
            Deno.exit(1);
          }
        },
      );
    } else {
      this.showHelp();
      // deno-lint-ignore no-console
      console.error(cliTheme.error('error: You need to provide "--id" or "--name" option to this command'));
      Deno.exit(1);
    }
  });

cli.parse(Deno.args);
