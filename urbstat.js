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
  URBSTAT_SERVER_URL: { defaultValue: 'http://127.0.0.1:55414' },
  URBSTAT_SERVER_USERNAME: { defaultValue: 'admin' },
  URBSTAT_SERVER_PASSWORD: { defaultValue: '' },
  URBSTAT_THRESHOLD_STALE_FILE: { defaultValue: 7200 },
  URBSTAT_THRESHOLD_STALE_IMAGE: { defaultValue: 7200 },
  URBSTAT_THRESHOLD_VOID_CLIENT: { defaultValue: 10080 },
  URBSTAT_LOCALE: { defaultValue: 'en' },
  URBSTAT_CLIENTS_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'list', 'number', 'raw'] },
  URBSTAT_CLIENTS_SORT: { defaultValue: 'name', acceptedValues: ['name', 'seen', 'file', 'image'] },
  URBSTAT_ACTIVITIES_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'number', 'raw'] },
  URBSTAT_ACTIVITIES_SORT_CURRENT: { defaultValue: 'client', acceptedValues: ['client', 'eta', 'progress', 'size'] },
  URBSTAT_ACTIVITIES_SORT_LAST: { defaultValue: 'time', acceptedValues: ['client', 'time', 'duration', 'size'] },
  URBSTAT_USAGE_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'raw'] },
  URBSTAT_USAGE_SORT: { defaultValue: 'total', acceptedValues: ['name', 'file', 'image', 'total'] },
  URBSTAT_CLIENT_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'raw'] },
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

// NOTE: Conversion is needed as UrBackup/Python uses seconds for timestamps whereas Javascript uses milliseconds.
/**
 * The current epoch time in seconds.
 */
const currentEpochTime = Math.round(new Date().getTime() / 1000.0);

/**
 * The status response from the server.
 */
let statusResponse;

/**
 * The activities response from the server.
 */
let activitiesResponse;

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
 * The failed-clients response from the server.
 */
let failedClientsResponse;

/**
 * The stale-clients response from the server.
 */
let staleClientsResponse;

/**
 * The blano-clients response from the server.
 */
let blankClientsResponse;

/**
 * The void-clients response from the server.
 */
let voidClientsResponse;

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
  const username = commandOptions?.user?.length > 0 ? commandOptions.user : getConfigValue('URBSTAT_SERVER_USERNAME');

  const password = commandOptions?.askPass === true
    ? await Secret.prompt('Enter password')
    : getConfigValue('URBSTAT_SERVER_PASSWORD');

  const server = new UrbackupServer({
    url: getConfigValue('URBSTAT_SERVER_URL'),
    username: username,
    password: password,
  });

  try {
    statusResponse = requiredCalls.includes('status')
      ? await server.getStatus({
        includeRemoved: true,
        clientId: commandOptions?.id,
        clientName: commandOptions?.name,
      })
      : null;

    activitiesResponse = requiredCalls.includes('activities')
      ? await server.getActivities({
        includeCurrent: true,
        includeLast: true,
        includePaused: commandOptions?.skipPaused !== true,
        clientName: commandOptions?.client?.length > 0 ? commandOptions.client : undefined,
      })
      : null;

    usageResponse = requiredCalls.includes('usage') ? await server.getUsage() : null;

    allClientsResponse = requiredCalls.includes('all-clients')
      ? await server.getClients({
        includeRemoved: true,
      })
      : null;

    okClientsResponse = requiredCalls.includes('ok-clients')
      ? await server.getOkClients({
        includeRemoved: false,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
        failOnFileIssues: commandOptions?.strict,
      })
      : null;

    failedClientsResponse = requiredCalls.includes('failed-clients')
      ? await server.getFailedClients({
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
        failOnFileIssues: commandOptions?.strict,
      })
      : null;

    staleClientsResponse = requiredCalls.includes('stale-clients')
      ? await server.getClients({
        includeRemoved: false,
      })
      : null;

    blankClientsResponse = requiredCalls.includes('blank-clients')
      ? await server.getBlankClients({
        includeRemoved: false,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
      })
      : null;

    voidClientsResponse = requiredCalls.includes('void-clients')
      ? await server.getUnseenClients({
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
        timeThreshold: commandOptions?.threshold,
      })
      : null;

    onlineClientsResponse = requiredCalls.includes('online-clients')
      ? await server.getOnlineClients({
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
      })
      : null;

    offlineClientsResponse = requiredCalls.includes('offline-clients')
      ? await server.getOfflineClients({
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
      })
      : null;

    activeClientsResponse = requiredCalls.includes('active-clients')
      ? await server.getActiveClients({
        includeRemoved: false,
      })
      : null;
  } catch (e) {
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
        last_imagebackup_issues,
        lastbackup_image,
        online,
        lastseen,
        status,
      },
    ) {
      // TODO: file_disabled, last_imagebackup_issues ??
      if (file_disabled === true) {
        file_ok = 'disabled';
      } else if (file_ok === true) {
        file_ok = last_filebackup_issues === 0 ? 'ok' : 'issues';
      } else {
        // TODO: no recent === failed?
        file_ok = 'failed';
      }

      if (image_disabled === true) {
        image_ok = 'disabled';
      } else if (image_ok === true) {
        image_ok = last_imagebackup_issues === 0 ? 'ok' : 'issues';
      } else {
        // TODO: no recent === failed?
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
      clients.sort((a, b) =>
        a['Client Name'].localeCompare(b['Client Name'], getConfigValue('URBSTAT_LOCALE'), { sensitivity: 'base' })
      );
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
 * @param {boolean} last - Flag indicating if it's the last activity.
 * @param {string} format - The format used for normalization.
 * @param {string} order - The sorting order (eta, progress, size, client, time, duration).
 * @param {boolean} reverse - Flag indicating whether to sort in reverse order.
 */
const sortActivities = function (activities, last, format, order, reverse) {
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
      activities.sort((a, b) =>
        a['Client Name'].localeCompare(b['Client Name'], getConfigValue('URBSTAT_LOCALE'), { sensitivity: 'base' })
      );
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
      usages.sort((a, b) =>
        a['Client Name'].localeCompare(b['Client Name'], getConfigValue('URBSTAT_LOCALE'), { sensitivity: 'base' })
      );
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

    return parseFloat((bytes / Math.pow(kilo, unitIndex)).toFixed(decimals < 0 ? 0 : decimals)) +
      ' ' + units[unitIndex];
  };

  // TODO: || 'raw'?
  if (format !== 'number') {
    for (const element in data) {
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
        console.log(data);
      }
      break;
    case 'number':
      console.log(data.length);
      break;
    case 'raw':
      console.log(data);
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
        sortActivities(data, false, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
        break;
      case 'lastActivities':
        sortActivities(data, true, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
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
  .version('0.11.1')
  .description(
    'The Missing Command-line Tool for UrBackup Server.\nDefault options like server address and password are set in the urbstat.conf configuration file.',
  )
  .example('Get failed clients, use password from configuration file', 'urbstat failed-clients')
  .example('Get failed clients, ask for password', 'urbstat failed-clients --ask-pass')
  .example('Get options and detailed help for specific command', 'urbstat failed-clients --help')
  .globalType(
    'clientsFormatValues',
    new EnumType(configFallback.URBSTAT_CLIENTS_FORMAT.acceptedValues),
  )
  .globalType(
    'clientsSortValues',
    new EnumType(configFallback.URBSTAT_CLIENTS_SORT.acceptedValues),
  )
  .globalType(
    'activitiesFormatValues',
    new EnumType(configFallback.URBSTAT_ACTIVITIES_FORMAT.acceptedValues),
  )
  .globalType(
    'currentActivitiesSortValues',
    new EnumType(configFallback.URBSTAT_ACTIVITIES_SORT_CURRENT.acceptedValues),
  )
  .globalType(
    'lastActivitiesSortValues',
    new EnumType(configFallback.URBSTAT_ACTIVITIES_SORT_LAST.acceptedValues),
  )
  .globalType(
    'usageFormatValues',
    new EnumType(configFallback.URBSTAT_USAGE_FORMAT.acceptedValues),
  )
  .globalType(
    'usageSortValues',
    new EnumType(configFallback.URBSTAT_USAGE_SORT.acceptedValues),
  )
  .globalType(
    'clientFormatValues',
    new EnumType(configFallback.URBSTAT_CLIENT_FORMAT.acceptedValues),
  )
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
  .action((commandOptions) => {
    makeServerCalls(['status'], commandOptions).then(() => {
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
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
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
  .action((commandOptions) => {
    makeServerCalls(['usage'], commandOptions).then(() => {
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
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .action((commandOptions) => {
    makeServerCalls(['all-clients'], commandOptions).then(() => {
      processMatchingData(allClientsResponse, 'clients', commandOptions);
      printOutput(allClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves OK clients, i.e., clients with OK backup status. Excludes clients marked for removal.
 * Backups finished with issues are treated as OK by default.
 * Required rights: status(all).
 * If you specify "raw" format, the output cannot be sorted or filtered,
 * and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli
  .command(
    'ok-clients',
    'Retrieves OK clients i.e. clients with OK backup status. Excludes clients marked for removal.\nBackups finished with issues are treated as OK by default.\nRequired rights: status(all).\nIf you specify "raw" format, the output cannot be sorted or filtered, and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
  )
  .example('Get OK clients, use default options', 'ok-clients')
  .example('Get the total number of OK clients', 'ok-clients --format "number"')
  .example('Get a sorted table', 'ok-clients --format "table" --sort "file"')
  .example('Get a sorted table, skip file backup problems', 'ok-clients --format "table" --sort "image" --skip-file')
  .example('Get reversed list', 'ok-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--strict', 'Do not treat backups finished with issues as being OK.')
  .action((commandOptions) => {
    makeServerCalls(['ok-clients'], commandOptions).then(() => {
      processMatchingData(okClientsResponse, 'clients', commandOptions);
      printOutput(okClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves failed clients i.e. clients with failed backup status or without a recent backup as configured in UrBackup Server.
 * Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'failed-clients',
  'Retrieves failed clients i.e. clients with failed backup status or without a recent backup as configured in UrBackup Server. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get FAILED clients, use default options', 'failed-clients')
  .example('Get the total number of FAILED clients', 'failed-clients --format "number"')
  .example('Get a sorted table', 'failed-clients --format "table" --sort "file"')
  .example(
    'Get a sorted table, skip file backup problems',
    'failed-clients --format "table" --sort "image" --skip-file',
  )
  .example('Get reversed list', 'failed-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
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
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_THRESHOLD_STALE_FILE, URBSTAT_THRESHOLD_STALE_IMAGE.
 */
cli.command(
  'stale-clients',
  'Retrieves stale clients i.e. clients without a recent backup as configured in urbstat. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.\nDefault options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_THRESHOLD_STALE_FILE, URBSTAT_THRESHOLD_STALE_IMAGE.',
)
  .example('Get STALE clients, use default options', 'stale-clients')
  .example('Get the total number of STALE clients', 'stale-clients --format "number"')
  .example('Get a sorted table', 'stale-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip BLANK clients', 'stale-clients --format "table" --sort "name" --skip-blank')
  .example('Get a sorted table, skip file backups', 'stale-clients --format "table" --sort "image" --skip-file')
  .example('Get reversed list', 'stale-clients --format "list" --sort "name" --reverse')
  .example(
    'Get clients with file backup older than a day',
    'stale-clients --format "table" --sort "name" --threshold-file 1440',
  )
  .example(
    'Get number of clients with image backup older than 12hrs',
    'stale-clients --format "number" --threshold-image 720 --skip-file',
  )
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--threshold-file <minutes:integer>', 'Set time threshold in minutes.', {
    default: getConfigValue('URBSTAT_THRESHOLD_STALE_FILE'),
  })
  .option('--threshold-image <minutes:integer>', 'Set time threshold in minutes.', {
    default: getConfigValue('URBSTAT_THRESHOLD_STALE_IMAGE'),
  })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
  .action((commandOptions) => {
    makeServerCalls(['stale-clients'], commandOptions).then(() => {
      const matchingClients = [];

      for (const client of staleClientsResponse) {
        if (commandOptions.skipFile !== true) {
          const timestampDifference = Math.round((currentEpochTime - (client?.lastbackup ?? 0)) / 60);
          if (
            (commandOptions.skipBlank !== true || (commandOptions.skipBlank === true && client.lastbackup !== 0)) &&
            client.file_disabled !== true &&
            timestampDifference >= commandOptions.thresholdFile
          ) {
            matchingClients.push(client);
            continue;
          }
        }

        if (commandOptions.skipImage !== true) {
          const timestampDifference = Math.round((currentEpochTime - (client?.lastbackup_image ?? 0)) / 60);
          if (
            (commandOptions.skipBlank !== true ||
              (commandOptions.skipBlank === true && client.lastbackup_image !== 0)) &&
            client.image_disabled !== true &&
            timestampDifference >= commandOptions.thresholdImage
          ) {
            matchingClients.push(client);
            continue;
          }
        }
      }

      processMatchingData(matchingClients, 'clients', commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });

/**
 * Retrieves blank clients i.e. clients without any finished backups. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.
 */
cli.command(
  'blank-clients',
  'Retrieves blank clients i.e. clients without any finished backups. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get BLANK clients, use default options', 'blank-clients')
  .example('Get the total number of BLANK clients', 'blank-clients --format "number"')
  .example('Get a sorted table', 'blank-clients --format "table" --sort "seen"')
  .example('Get a sorted table, skip image backups', 'blank-clients --format "table" --sort "name" --skip-image')
  .example('Get reversed list', 'blank-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .action((commandOptions) => {
    makeServerCalls(['blank-clients'], commandOptions).then(() => {
      processMatchingData(blankClientsResponse, 'clients', commandOptions);
      printOutput(blankClientsResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves void clients i.e. clients not seen for a long time as configured in urbstat. Excludes clients marked for removal.
 * Required rights: status(all).
 * If you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.
 * Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_THRESHOLD_VOID_CLIENT.
 */
cli
  .command(
    'void-clients',
    'Retrieves void clients i.e. clients not seen for a long time as configured in urbstat. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE, URBSTAT_THRESHOLD_VOID_CLIENT.',
  )
  .example('Get VOID clients, use default options', 'void-clients')
  .example('Get the total number of VOID clients', 'void-clients --format "number"')
  .example('Get a sorted table', 'void-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip BLANK clients', 'void-clients --format "table" --sort "seen" --skip-blank')
  .example('Get reversed list', 'void-clients --format "list" --sort "name" --reverse')
  .example('Get clients not seen for more than 2 days', 'void-clients --format "table" --sort "name" --threshold 2880')
  .example('Get number of clients not seen for more than 12hrs', 'void-clients --format "number" --threshold 720')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', {
    default: getConfigValue('URBSTAT_THRESHOLD_VOID_CLIENT'),
  })
  .option('--skip-blank', 'Skip blank clients.')
  .action((commandOptions) => {
    makeServerCalls(['void-clients'], commandOptions).then(() => {
      processMatchingData(voidClientsResponse, 'clients', commandOptions);
      printOutput(voidClientsResponse, commandOptions?.format);
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
  'Retrieves online clients. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get ONLINE clients, use default options', 'online-clients')
  .example('Get the total number of ONLINE clients', 'online-clients --format "number"')
  .example('Get a sorted table', 'online-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip BLANK clients', 'online-clients --format "table" --sort "name" --skip-blank')
  .example('Get reversed list', 'online-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-blank', 'Skip blank clients.')
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
  'Retrieves offline clients. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get OFFLINE clients, use default options', 'offline-clients')
  .example('Get the total number of OFFLINE clients', 'offline-clients --format "number"')
  .example('Get a sorted table', 'offline-clients --format "table" --sort "name"')
  .example('Get a sorted table, skip BLANK clients', 'offline-clients --format "table" --sort "name" --skip-blank')
  .example('Get reversed list', 'offline-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--skip-blank', 'Skip blank clients.')
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
  'Retrieves currently active clients. Excludes clients marked for removal.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered. Default options are configured with: URBSTAT_CLIENTS_FORMAT, URBSTAT_CLIENTS_SORT, URBSTAT_LOCALE.',
)
  .example('Get ACTIVE clients, use default options', 'active-clients')
  .example('Get the total number of ACTIVE clients', 'active-clients --format "number"')
  .example('Get a sorted table', 'active-clients --format "table" --sort "name"')
  .example('Get reversed list', 'active-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT'),
  })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_CLIENTS_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
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
  .example(
    'Get a sorted table, skip PAUSED activities',
    'current-activities --format "table" --sort "progress" --skip-paused',
  )
  .example(
    'Get three activities with longest ETA',
    'current-activities --format "table" --sort "eta" --max 3 --reverse',
  )
  .example(
    'Get CURRENT activities of selected client',
    'current-activities --format "table" --sort "eta" --client "office"',
  )
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT'),
  })
  .option('--sort <field:currentActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_ACTIVITIES_SORT_CURRENT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format. ")
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', { default: 0 })
  .option('--skip-paused', 'Skip paused activities.')
  .option('--client <name:string>', 'Limit activities to specified client only.', { default: '' })
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
  .example('Get LAST activities of selected client', 'last-activities --format "table" --sort "time" --client "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT'),
  })
  .option('--sort <field:lastActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_ACTIVITIES_SORT_LAST'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', { default: 0 })
  .option('--client <name:string>', 'Limit activities to specified client only.', { default: '' })
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
  .example('Get PAUSED activities, use default options', 'paused-activities')
  .example('Get the total number of PAUSED activities', 'paused-activities --format "number"')
  .example('Get a sorted table', 'paused-activities --format "table" --sort "progress"')
  .example('Get 3 activities with biggest size', 'paused-activities --format "table" --sort "size" --max 3 --reverse')
  .example('Get PAUSED activities of a client', 'paused-activities --format "table" --sort "time" --client "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT'),
  })
  .option('--sort <field:currentActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_ACTIVITIES_SORT_CURRENT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', { default: 0 })
  .option('--client <name:string>', 'Limit activities to specified client only.', { default: '' })
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
      const matchingActivities = [];

      for (const activity of activitiesResponse.current) {
        if (activity.paused === true) {
          if (commandOptions.client.length > 0 && activity.name !== commandOptions.client) {
            continue;
          }

          matchingActivities.push(activity);
        }
      }

      processMatchingData(matchingActivities, 'currentActivities', commandOptions);
      printOutput(matchingActivities, commandOptions?.format);
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
  .example('Get storage usage of selected client', 'usage --format "table" --client "office"')
  .option('--format <format:usageFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_USAGE_FORMAT'),
  })
  .option('--sort <field:usageSortValues>', "Change the sorting order. Ignored with 'raw' output format.", {
    default: getConfigValue('URBSTAT_USAGE_SORT'),
  })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--client <name:string>', 'Limit usage to specified client only.', { default: '' })
  .action((commandOptions) => {
    makeServerCalls(['usage'], commandOptions).then(() => {
      const matchingUsage = [];

      for (const usage of usageResponse) {
        if (commandOptions.client.length > 0 && usage.name !== commandOptions.client) {
          continue;
        }

        matchingUsage.push(usage);
      }

      processMatchingData(matchingUsage, 'usage', commandOptions);
      printOutput(matchingUsage, commandOptions?.format);
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
  .option('--format <format:clientFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENT_FORMAT'),
  })
  .option('--id <Id:integer>', "Client's Id Number.", { conflicts: ['name'] })
  .option('--name <name:string>', "Client's Name.")
  .action(function (commandOptions) {
    // NOTE: don't use arrow function in action (need access to this)

    if (commandOptions?.id > 0 || commandOptions?.name?.length > 0) {
      makeServerCalls(['status', 'activities', 'usage'], commandOptions).then(
        () => {
          const matchingClient = [];
          matchingClient.push(statusResponse[0]);

          if (typeof matchingClient[0] !== 'undefined' && matchingClient[0]?.id > 0) {
            const matchingClientId = matchingClient[0].id;
            const matchingCurrentActivities = activitiesResponse.current.filter((activity) =>
              activity.clientid === matchingClientId
            );
            const matchingLastActivities = activitiesResponse.last.filter((activity) =>
              activity.clientid === matchingClientId
            );
            const matchingUsage = [];
            matchingUsage.push(usageResponse.find((element) => element.name === matchingClient[0].name));

            console.log('Status:');
            processMatchingData(matchingClient, 'clients', commandOptions);
            printOutput(matchingClient, commandOptions?.format);

            console.log('Current activities:');
            processMatchingData(matchingCurrentActivities, 'currentActivities', commandOptions);
            if (matchingCurrentActivities.length > 0) {
              printOutput(matchingCurrentActivities, commandOptions?.format);
            } else {
              if (commandOptions?.format !== 'raw') {
                console.log('none');
              }
            }

            console.log('Last activities:');
            processMatchingData(matchingLastActivities, 'lastActivities', commandOptions);
            if (matchingLastActivities.length > 0) {
              printOutput(matchingLastActivities, commandOptions?.format);
            } else {
              console.log('none');
            }

            console.log('Usage:');
            processMatchingData(matchingUsage, 'usage', commandOptions);
            printOutput(matchingUsage, commandOptions?.format);
          } else {
            console.log(cliTheme.warning('Client not found'));
            Deno.exit(1);
          }
        },
      );
    } else {
      this.showHelp();
      console.log(cliTheme.error('error: You need to provide "--id" or "--name" option to this command'));
      Deno.exit(1);
    }
  });

cli.parse(Deno.args);
