import { colors } from '@cliffy/ansi/colors';
import { Command, EnumType } from '@cliffy/command';
import { load } from '@std/dotenv';
import { Secret } from '@cliffy/prompt';
import { Table } from '@cliffy/table';
import { UrbackupServer } from 'urbackup-server-api';
import ms from 'ms';

/**
 * Common text style definitions for CLI messages.
 */
const cliTheme = { error: colors.bold.red, warning: colors.yellow, information: colors.blue };

/**
 * Hard-coded settings used as a fallback when not found in the configuration file.
 */
const fallbackSettings = {
  URBSTAT_ACTIVITIES_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'number', 'raw'] },
  URBSTAT_ACTIVITIES_SORT_CURRENT: { defaultValue: 'client', acceptedValues: ['client', 'eta', 'progress', 'size'] },
  URBSTAT_ACTIVITIES_SORT_LAST: { defaultValue: 'time', acceptedValues: ['client', 'time', 'duration', 'size'] },
  URBSTAT_CLIENT_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'raw'] },
  URBSTAT_CLIENTS_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'list', 'number', 'raw'] },
  URBSTAT_CLIENTS_SORT: { defaultValue: 'name', acceptedValues: ['name', 'seen', 'file', 'image'] },
  URBSTAT_CLIENTS_THRESHOLD_STALE: { defaultValue: 7200 },
  URBSTAT_CLIENTS_THRESHOLD_UNSEEN: { defaultValue: 10080 },
  URBSTAT_GROUPS_SORT: { defaultValue: 'name', acceptedValues: ['name', 'id'] },
  URBSTAT_GROUPS_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'list', 'number', 'raw'] },
  URBSTAT_LOCALE: { defaultValue: 'en' },
  URBSTAT_SERVER_PASSWORD: { defaultValue: '' },
  URBSTAT_SERVER_URL: { defaultValue: 'http://127.0.0.1:55414' },
  URBSTAT_SERVER_USERNAME: { defaultValue: 'admin' },
  URBSTAT_USAGE_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'raw'] },
  URBSTAT_USAGE_SORT: { defaultValue: 'total', acceptedValues: ['name', 'file', 'image', 'total'] },
  URBSTAT_USERS_SORT: { defaultValue: 'name', acceptedValues: ['name', 'id'] },
  URBSTAT_USERS_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'list', 'number', 'raw'] },
};

/**
 * Settings loaded from the configuration file.
 */
const settings = await load({ envPath: './urbstat.conf', export: false });

/**
 * Gets the settings value for the specified key.
 * If the key is recognized, it uses the value from the configuration file, falling back to the hard-coded default if not found there.
 *
 * @param {string} key - The settings key.
 * @returns {*} The settings value, `null` if the key is not recognized.
 */
const getSettings = (key) => {
  if (key in fallbackSettings) {
    return settings[key] ?? fallbackSettings[key].defaultValue;
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
 * The users response from the server.
 */
let usersResponse;

/**
 * The groups response from the server.
 */
let groupsResponse;

/**
 * Make the required API calls to the UrBackup Server.
 *
 * @param {string[]} requiredCalls - The required API calls.
 * @param {Object} commandOptions - The command options.
 * @returns {Promise<void>}
 */
async function makeServerCalls(requiredCalls, commandOptions) {
  const urlString = (typeof commandOptions?.url === 'string' && commandOptions.url.length > 0) ? commandOptions.url : getSettings('URBSTAT_SERVER_URL');
  if (!URL.canParse(urlString)) {
    // deno-lint-ignore no-console
    console.log(cliTheme.error('error: Invalid URL'));
    Deno.exit(1);
  }

  const url = new URL(urlString);
  const username = (typeof commandOptions?.user === 'string' && commandOptions.user.length > 0) ? commandOptions.user : getSettings('URBSTAT_SERVER_USERNAME');
  const password = commandOptions?.askPass === true ? await Secret.prompt('Enter password') : getSettings('URBSTAT_SERVER_PASSWORD');

  const server = new UrbackupServer({
    url: url.href,
    username: username,
    password: password,
  });

  try {
    statusResponse = requiredCalls.includes('status')
      ? await server.getStatus({
        clientId: typeof commandOptions?.id === 'number' ? commandOptions.id : undefined,
        clientName: (typeof commandOptions?.name === 'string' && commandOptions.name.length > 0) ? commandOptions.name : undefined,
        includeRemoved: true,
      })
      : null;

    activitiesResponse = requiredCalls.includes('activities')
      ? await server.getActivities({
        clientId: typeof commandOptions?.clientId === 'number' ? commandOptions.clientId : undefined,
        clientName: (typeof commandOptions?.name === 'string' && commandOptions.name.length > 0) ? commandOptions.name : undefined,
        includeCurrent: true,
        includeLast: true,
        includePaused: commandOptions?.skipPaused !== true,
      })
      : null;

    pausedActivitiesResponse = requiredCalls.includes('paused-activities')
      ? await server.getPausedActivities({
        clientId: typeof commandOptions?.clientId === 'number' ? commandOptions.clientId : undefined,
        clientName: (typeof commandOptions?.name === 'string' && commandOptions.name.length > 0) ? commandOptions.name : undefined,
      })
      : null;

    usageResponse = requiredCalls.includes('usage')
      ? await server.getUsage({
        clientName: (typeof commandOptions?.name === 'string' && commandOptions.name.length > 0) ? commandOptions.name : undefined,
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
        timeThreshold: (typeof commandOptions?.threshold === 'number' && commandOptions.threshold >= 0) ? commandOptions.threshold : 0,
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
        timeThreshold: (typeof commandOptions?.threshold === 'number' && commandOptions.threshold >= 0) ? commandOptions.threshold : 0,
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

    usersResponse = requiredCalls.includes('users') ? await server.getUsers({}) : null;

    groupsResponse = requiredCalls.includes('groups') ? await server.getGroups({}) : null;
  } catch (error) {
    // deno-lint-ignore no-console
    console.log(cliTheme.error(error.message));
    Deno.exit(1);
  }
}

/**
 * Normalizes a client object for further use in the application.
 *
 * @param {Object} client - The client object to normalize.
 * @param {string} format - The desired output format. If the format is 'raw', the original object is returned unchanged.
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
 * Normalizes an activity object for further use in the application.
 *
 * @param {Object} activity - The activity object to normalize.
 * @param {boolean} last - A flag indicating whether this is the last activity.
 * @param {string} format - The desired output format. If the format is 'raw', the original object is returned unchanged.
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
 * Normalizes a usage object for further use in the application.
 *
 * @param {Object} usage - The usage object to normalize.
 * @param {string} format - The desired output format. If the format is 'raw', the original object is returned unchanged.
 * @returns {Object} The normalized usage object.
 */
const normalizeUsage = function (usage, format) {
  if (format === 'raw') {
    return usage;
  } else {
    return (function ({ files, images, name, used }) {
      return ({
        'Client Name': name,
        'File Backups': files,
        'Image Backups': images,
        'Total': used,
      });
    })(usage);
  }
};

/**
 * Normalizes a user object for further use in the application.
 *
 * @param {Object} user - The user object to normalize.
 * @param {string} format - The desired output format. If the format is 'raw', the original object is returned unchanged.
 * @returns {Object} The normalized user object.
 */
const normalizeUser = function (user, format) {
  if (format === 'raw') {
    return user;
  } else {
    return (function ({ id, name, rights }) {
      return ({
        'User Id': id,
        'User Name': name,
        'User Rights': rights,
      });
    })(user);
  }
};

/**
 * Normalizes a group object for further use in the application.
 *
 * @param {Object} group - The group object to normalize.
 * @param {string} format - The desired output format. If the format is 'raw', the original object is returned unchanged.
 * @returns {Object} The normalized user object.
 */
const normalizeGroup = function (group, format) {
  if (format === 'raw') {
    return group;
  } else {
    return (function ({ id, name }) {
      return ({
        'Group Id': id,
        'Group Name': name,
      });
    })(group);
  }
};

/**
 * Sorts an array of objects. This function sorts the elements of an array in place.
 * NOTE: Sorting must be done after normalization.
 *
 * @param {Array} elements - The array of elements (objects) to sort.
 * @param {string} outputFormat - The output format.
 * @param {string} order - The sorting order key.
 * @param {boolean} reverse - A flag indicating whether to sort in reverse order.
 * @param {Object} orderToProperty - A mapping of sorting order keys to object property names used for sorting.
 */
const sortElements = function (elements, outputFormat, order, reverse, orderToProperty) {
  const property = orderToProperty[order];

  if (typeof property === 'undefined') {
    return;
  }

  elements.sort((a, b) => {
    const valueA = a[property];
    const valueB = b[property];

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return valueA.localeCompare(valueB, getSettings('URBSTAT_LOCALE'), { sensitivity: 'base' });
    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueA - valueB;
    }
  });

  if (reverse === true && outputFormat !== 'number') {
    elements.reverse();
  }
};

/**
 * Prints data to the console based on the specified format.
 *
 * @param {Array} data - The data to print.
 * @param {string} format - The output format (table, list, number, raw).
 */
const printOutput = function (data, format) {
  /**
   * Formats a byte count into a human-readable string.
   *
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

  if (format !== 'number' && format !== 'raw') {
    data.forEach((item) => {
      Object.keys(item).forEach(function (key) {
        switch (key) {
          case 'Bytes Done': // NOTE: falls through
          case 'File Backups': // NOTE: falls through
          case 'Image Backups': // NOTE: falls through
          case 'Total': // NOTE: falls through
          case 'Size':
            item[key] = formatBytes(item[key], 2);
            break;
          case 'Duration':
            item[key] = ms(item[key] * 1000);
            break;
          case 'ETA':
            item[key] = item[key] <= 0 ? 'n/a' : ms(item[key]);
            break;
          case 'Starting Time': // NOTE: falls through
          case 'Last File BUP': // NOTE: falls through
          case 'Last Image BUP': // NOTE: falls through
          case 'Last Seen':
            if (item[key] === 0) {
              item[key] = 'never';
            } else {
              item[key] = new Date(item[key] * 1000).toLocaleString(getSettings('URBSTAT_LOCALE'));
            }
            break;
          case 'Activity':
            if (item[key] === 0) {
              item[key] = 'none';
            }
            break;
          case 'Progress':
            item[key] = `${item[key]}%`;
            break;
          case 'User Rights':
            item[key] = JSON.stringify(item[key]);
            break;
        }
      });
    });
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
        console.log(data);
      }
      break;
    case 'number':
      // deno-lint-ignore no-console
      console.log(data.length);
      break;
    case 'raw':
      // deno-lint-ignore no-console
      console.log(data);
      break;
  }
};

/**
 * Processes matching data by normalizing, sorting, and limiting it.
 * This function modifies the input array in place.
 *
 * @param {Array} data - The array of data to be processed.
 * @param {string} type - The type of data being processed.
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
      case 'users':
        data[index] = normalizeUser(element, commandOptions?.format);
        break;
      case 'groups':
        data[index] = normalizeGroup(element, commandOptions?.format);
        break;
      default:
        break;
    }
  });

  if (commandOptions.format !== 'raw') {
    switch (type) {
      case 'clients':
        sortElements(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse, {
          name: 'Client Name',
          seen: 'Last Seen',
          file: 'Last File BUP',
          image: 'Last Image BUP',
        });
        break;
      case 'currentActivities':
        sortElements(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse, {
          eta: 'ETA',
          progress: 'Progress',
          size: 'Size',
          client: 'Client Name',
        });
        break;
      case 'lastActivities':
        sortElements(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse, {
          size: 'Size',
          client: 'Client Name',
          time: 'Starting Time',
          duration: 'Duration',
        });
        break;
      case 'usage':
        sortElements(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse, {
          name: 'Client Name',
          file: 'File Backups',
          image: 'Image Backups',
          total: 'Total',
        });
        break;
      case 'users':
        sortElements(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse, {
          name: 'User Name',
          id: 'User Id',
        });
        break;
      case 'groups':
        sortElements(data, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse, {
          name: 'Group Name',
          id: 'Group Id',
        });
        break;
      default:
        break;
    }
  }

  data.splice(commandOptions?.max > 0 ? commandOptions.max : data.length);

  data.forEach((element, index) => {
    if (type === 'clients') {
      switch (commandOptions?.format) {
        case 'list': // NOTE: falls through
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

    if (type === 'users') {
      switch (commandOptions?.format) {
        case 'list': // NOTE: falls through
        case 'number':
          data[index] = element['User Name'];
          break;
      }
    }

    if (type === 'groups') {
      switch (commandOptions?.format) {
        case 'list': // NOTE: falls through
        case 'number':
          data[index] = element['Group Name'];
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
  .version('0.17.0')
  .description('The Missing Command-line Tool for UrBackup Server.\nDefault options, such as server address and password, are set in the `urbstat.conf` configuration file.')
  .example('Get failed clients (uses password from configuration file)', 'urbstat failed-clients')
  .example('Get failed clients (prompts for password)', 'urbstat failed-clients --ask-pass')
  .example('Get options and detailed help for a specific command', 'urbstat failed-clients --help')
  .globalType('activitiesFormatValues', new EnumType(fallbackSettings.URBSTAT_ACTIVITIES_FORMAT.acceptedValues))
  .globalType('clientFormatValues', new EnumType(fallbackSettings.URBSTAT_CLIENT_FORMAT.acceptedValues))
  .globalType('clientsFormatValues', new EnumType(fallbackSettings.URBSTAT_CLIENTS_FORMAT.acceptedValues))
  .globalType('clientsSortValues', new EnumType(fallbackSettings.URBSTAT_CLIENTS_SORT.acceptedValues))
  .globalType('currentActivitiesSortValues', new EnumType(fallbackSettings.URBSTAT_ACTIVITIES_SORT_CURRENT.acceptedValues))
  .globalType('groupsFormatValues', new EnumType(fallbackSettings.URBSTAT_GROUPS_FORMAT.acceptedValues))
  .globalType('groupsSortValues', new EnumType(fallbackSettings.URBSTAT_GROUPS_SORT.acceptedValues))
  .globalType('lastActivitiesSortValues', new EnumType(fallbackSettings.URBSTAT_ACTIVITIES_SORT_LAST.acceptedValues))
  .globalType('usageFormatValues', new EnumType(fallbackSettings.URBSTAT_USAGE_FORMAT.acceptedValues))
  .globalType('usageSortValues', new EnumType(fallbackSettings.URBSTAT_USAGE_SORT.acceptedValues))
  .globalType('usersFormatValues', new EnumType(fallbackSettings.URBSTAT_USERS_FORMAT.acceptedValues))
  .globalType('usersSortValues', new EnumType(fallbackSettings.URBSTAT_USERS_SORT.acceptedValues))
  .globalOption('--url <url:string>', 'Server URL.')
  .globalOption('--user <name:string>', 'User name.')
  .globalOption('--ask-pass', 'Ask for connection password.')
  .action(() => {
    cli.showHelp();
    Deno.exit(0);
  });

/**
 * Get raw response of "status" API call. Matches all clients, including those marked for removal.
 * Required rights: `status(all)`.
 * Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.
 */
cli.command(
  'raw-status',
  "Gets the raw JSON response of the 'status' API call. Matches all clients, including those marked for removal.\nRequired rights: `status(all)`.\nRaw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.",
)
  .example('Get the raw status response', 'raw-status')
  .action((commandOptions) => {
    makeServerCalls(['status'], commandOptions).then(() => {
      printOutput(statusResponse, 'raw');
    });
  });

/**
 * Get raw response of "activities" API call. Matches all clients, including those marked for removal.
 * Required rights: `progress(all)`, `lastacts(all)`.
 * Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.
 */
cli.command(
  'raw-activities',
  "Gets the raw JSON response of the 'activities' API call. Matches all clients, including those marked for removal.\nRequired rights: `progress(all)`, `lastacts(all)`.\nRaw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.",
)
  .example('Get the raw activities response', 'raw-activities')
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
      printOutput(activitiesResponse, 'raw');
    });
  });

/**
 * Get raw response of "usage" API call. Matches all clients, including those marked for removal.
 * Required rights: `piegraph(all)`.
 * Raw responses cannot be sorted, filtered, etc. Property names and values are left unaltered.
 */
cli.command(
  'raw-usage',
  "Gets the raw JSON response of the 'usage' API cal. Matches all clients, including those marked for removal.\nRequired rights: `piegraph(all)`.\nRaw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.",
)
  .example('Get the raw usage response', 'raw-usage')
  .action((commandOptions) => {
    makeServerCalls(['usage', commandOptions]).then(() => {
      printOutput(usageResponse, 'raw');
    });
  });

/**
 * Retrieves all clients, including those marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`."
 */
cli.command(
  'all-clients',
  "Retrieves all clients, including those marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get all clients (uses default options)', 'all-clients')
  .example('Get the total count of all clients', 'all-clients --format "number"')
  .example('Get all clients as a table, sorted by last file backup time', 'all-clients --format "table" --sort "file"')
  .example('Get all clients as a list, sorted by name in reverse order', 'all-clients --format "list" --sort "name" --reverse')
  .example('Get names of the 3 longest-unseen clients', 'all-clients --format "list" --sort "seen" --max 3')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Retrieves clients with an 'OK' backup status. Excludes clients marked for removal.
 * Backups finished with issues are treated as OK by default.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli
  .command(
    'ok-clients',
    "Retrieves clients with an 'OK' backup status. Excludes clients marked for removal.\nBackups finished with issues are treated as OK by default.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
  )
  .example('Get OK clients (uses default options)', 'ok-clients')
  .example('Get the total count of OK clients', 'ok-clients --format "number"')
  .example('Get OK clients as a table, sorted by last file backup time', 'ok-clients --format "table" --sort "file"')
  .example('Get OK clients as a table, sorted by last image backup time, ignoring file backup status', 'ok-clients --format "table" --sort "image" --skip-file')
  .example('Get OK clients as a list, sorted by name in reverse order', 'ok-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Retrieves clients running an outdated version of the UrBackup client software. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'outdated-clients',
  "Retrieves clients running an outdated version of the UrBackup client software. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get outdated clients (uses default options)', 'outdated-clients')
  .example('Get the total count of outdated clients', 'outdated-clients --format "number"')
  .example('Get outdated clients as a table, sorted by name', 'outdated-clients --format "table" --sort "name"')
  .example('Get outdated clients as a list, sorted by name in reverse order', 'outdated-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Retrieves clients with a 'failed' backup status or those without a recent backup (as per UrBackup Server settings). Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'failed-clients',
  "Retrieves clients with a 'failed' backup status or those without a recent backup (as per UrBackup Server settings). Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get failed clients (uses default options)', 'failed-clients')
  .example('Get the total count of failed clients', 'failed-clients --format "number"')
  .example('Get failed clients as a table, sorted by last file backup time', 'failed-clients --format "table" --sort "file"')
  .example('Get failed clients as a table, sorted by last image backup time, ignoring file backup status', 'failed-clients --format "table" --sort "image" --skip-file')
  .example('Get failed clients as a list, sorted by name in reverse order', 'failed-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Retrieves 'stale' clients, i.e., clients without a recent backup according to the `urbstat` configured threshold. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_STALE`.
 */
cli.command(
  'stale-clients',
  "Retrieves 'stale' clients, i.e., clients without a recent backup according to the `urbstat` configured threshold. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_STALE`.",
)
  .example('Get stale clients (uses default options)', 'stale-clients')
  .example('Get the total count of stale clients', 'stale-clients --format "number"')
  .example('Get stale clients as a table, sorted by name', 'stale-clients --format "table" --sort "name"')
  .example('Get stale clients as a table, sorted by name, excluding blank clients', 'stale-clients --format "table" --sort "name" --skip-blank')
  .example('Get stale clients as a table, sorted by last image backup time, considering only image backups', 'stale-clients --format "table" --sort "image" --skip-file')
  .example('Get stale clients as a list, sorted by name in reverse order', 'stale-clients --format "list" --sort "name" --reverse')
  .example('Get clients whose last file backup is older than 1 day (1440 minutes)', 'stale-clients --format "table" --sort "name" --threshold 1440 --skip-image')
  .example('Get count of clients whose last image backup is older than 12 hours (720 minutes)', 'stale-clients --format "number" --threshold 720 --skip-file')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', { default: getSettings('URBSTAT_CLIENTS_THRESHOLD_STALE') })
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
 * Retrieves 'blank' clients, i.e., clients that have no completed backups. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'blank-clients',
  "Retrieves 'blank' clients, i.e., clients that have no completed backups. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get blank clients (uses default options)', 'blank-clients')
  .example('Get the total count of blank clients', 'blank-clients --format "number"')
  .example('Get blank clients as a table, sorted by last seen time', 'blank-clients --format "table" --sort "seen"')
  .example('Get blank clients as a table, sorted by name, considering only file backups', 'blank-clients --format "table" --sort "name" --skip-image')
  .example('Get blank clients as a list, sorted by name in reverse order', 'blank-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Retrieves 'unseen' clients, i.e., clients not seen by the server for a duration exceeding the `urbstat` configured threshold. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_UNSEEN`.
 */
cli
  .command(
    'unseen-clients',
    "Retrieves 'unseen' clients, i.e., clients not seen by the server for a duration exceeding the `urbstat` configured threshold. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_UNSEEN`.",
  )
  .example('Get unseen clients (uses default options)', 'unseen-clients')
  .example('Get the total count of unseen clients', 'unseen-clients --format "number"')
  .example('Get unseen clients as a table, sorted by name', 'unseen-clients --format "table" --sort "name"')
  .example('Get unseen clients as a table, sorted by last seen time, excluding blank clients', 'unseen-clients --format "table" --sort "seen" --skip-blank')
  .example('Get unseen clients as a list, sorted by name in reverse order', 'unseen-clients --format "list" --sort "name" --reverse')
  .example('Get clients not seen for more than 2 days (2880 minutes)', 'unseen-clients --format "table" --sort "name" --threshold 2880')
  .example('Get count of clients not seen for more than 12 hours (720 minutes)', 'unseen-clients --format "number" --threshold 720')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', { default: 0 })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', { default: getSettings('URBSTAT_CLIENTS_THRESHOLD_UNSEEN') })
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
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'removed-clients',
  "Retrieves clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get clients marked for removal (uses default options)', 'removed-clients')
  .example('Get the total count of clients marked for removal', 'removed-clients --format "number"')
  .example('Get clients marked for removal as a table, sorted by name', 'removed-clients --format "table" --sort "name"')
  .example('Get clients marked for removal as a list, sorted by name in reverse order', 'removed-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'online-clients',
  "Retrieves online clients. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get online clients (uses default options)', 'online-clients')
  .example('Get the total count of online clients', 'online-clients --format "number"')
  .example('Get online clients as a table, sorted by name', 'online-clients --format "table" --sort "name"')
  .example('Get online clients as a table, sorted by name, excluding blank clients', 'online-clients --format "table" --sort "name" --skip-blank')
  .example('Get online clients as a list, sorted by name in reverse order', 'online-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'offline-clients',
  "Retrieves offline clients. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get offline clients (uses default options)', 'offline-clients')
  .example('Get the total count of offline clients', 'offline-clients --format "number"')
  .example('Get offline clients as a table, sorted by name', 'offline-clients --format "table" --sort "name"')
  .example('Get offline clients as a table, sorted by name, excluding blank clients', 'offline-clients --format "table" --sort "name" --skip-blank')
  .example('Get offline clients as a list, sorted by name in reverse order', 'offline-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Required rights: `status(all)`
 * nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`
 .*/
cli.command(
  'active-clients',
  "Retrieves currently active clients. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get currently active clients (uses default options)', 'active-clients')
  .example('Get the total count of currently active clients', 'active-clients --format "number"')
  .example('Get currently active clients as a table, sorted by name', 'active-clients --format "table" --sort "name"')
  .example('Get currently active clients as a list, sorted by name in reverse order', 'active-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_CLIENTS_SORT') })
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
 * Required rights: `progress(all)`, `lastacts(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'current-activities',
  "Retrieves current activities.\nRequired rights: `progress(all)`, `lastacts(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.",
)
  .example('Get current activities (uses default options)', 'current-activities')
  .example('Get the total count of current activities', 'current-activities --format "number"')
  .example('Get current activities as a table, sorted by progress', 'current-activities --format "table" --sort "progress"')
  .example('Get current activities as a table, sorted by progress, excluding paused activities', 'current-activities --format "table" --sort "progress" --skip-paused')
  .example('Get the 3 current activities with the longest ETA, sorted descending', 'current-activities --format "table" --sort "eta" --max 3 --reverse')
  .example("Get current activities for client 'office', sorted by ETA", 'current-activities --format "table" --sort "eta" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:currentActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_ACTIVITIES_SORT_CURRENT') })
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
 * Retrieves recently completed activities.
 * Required rights: `progress(all)`, `lastacts(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.
 */
cli.command(
  'last-activities',
  "Retrieves recently completed activities.\nRequired rights: `progress(all)`, `lastacts(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.",
)
  .example('Get last activities (uses default options)', 'last-activities')
  .example('Get the total count of last activities', 'last-activities --format "number"')
  .example('Get last activities as a table, sorted by start time', 'last-activities --format "table" --sort "time"')
  .example('Get the 3 last activities with the largest size, sorted descending', 'last-activities --format "table" --sort "size" --max 3 --reverse')
  .example('Get the 3 last activities with the longest duration, sorted descending', 'last-activities --format "table" --sort "duration" --max 3 --reverse')
  .example("Get last activities for client 'office', sorted by start time", 'last-activities --format "table" --sort "time" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:lastActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_ACTIVITIES_SORT_LAST') })
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
 * Required rights: `progress(all)`, `lastacts(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'paused-activities',
  "Retrieves paused activities.\nRequired rights: `progress(all)`, `lastacts(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.",
)
  .example('Get paused activities (uses default options)', 'paused-activities')
  .example('Get the total count of paused activities', 'paused-activities --format "number"')
  .example('Get paused activities as a table, sorted by progress', 'paused-activities --format "table" --sort "progress"')
  .example('Get the 3 paused activities with the largest size, sorted descending', 'paused-activities --format "table" --sort "size" --max 3 --reverse')
  .example("Get paused activities for client 'office', sorted by client name", 'paused-activities --format "table" --sort "client" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:currentActivitiesSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_ACTIVITIES_SORT_CURRENT') })
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
 * Retrieves storage usage statistics for clients.
 * Required rights: `piegraph(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_USAGE_FORMAT`, `URBSTAT_USAGE_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'usage',
  "Retrieves storage usage statistics for clients.\nRequired rights: `piegraph(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_USAGE_FORMAT`, `URBSTAT_USAGE_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get storage usage (uses default options)', 'usage')
  .example('Get storage usage as a table, sorted by client name', 'usage --format "table" --sort "name"')
  .example('Get the 3 clients with the largest storage usage, sorted descending', 'usage --format "table" --sort "total" --max 3 --reverse')
  .example("Get storage usage for client 'office'", 'usage --format "table" --client-name "office"')
  .option('--format <format:usageFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_USAGE_FORMAT') })
  .option('--sort <field:usageSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_USAGE_SORT') })
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
 * Retrieves comprehensive information for a single client, including status, activities, and usage.
 * Required rights: `status(all)`, `progress(all)`, `lastacts(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is. Sorting and filtering are not applied to raw output for sub-sections.
 * Default options are configured using: `URBSTAT_CLIENT_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.
 */
cli.command(
  'client',
  "Retrieves comprehensive information for a single client, including status, activities, and usage.\nRequired rights: `status(all)`, `progress(all)`, `lastacts(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is. Sorting and filtering are not applied to raw output for sub-sections (activities, usage).\nDefault options for formatting and sorting activities are configured using: `URBSTAT_CLIENT_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.",
)
  .example("Get all information for the client named 'office'", 'client --name "office"')
  .option('--format <format:clientFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENT_FORMAT') })
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
            console.log(cliTheme.information('Status:'));
            processMatchingData(matchingClient, 'clients', commandOptions);
            printOutput(matchingClient, commandOptions?.format);

            // deno-lint-ignore no-console
            console.log(cliTheme.information('Current activities:'));
            processMatchingData(matchingCurrentActivities, 'currentActivities', commandOptions);
            if (matchingCurrentActivities.length > 0) {
              printOutput(matchingCurrentActivities, commandOptions?.format);
            } else {
              if (commandOptions?.format !== 'raw') {
                // deno-lint-ignore no-console
                console.log('none');
              }
            }

            // deno-lint-ignore no-console
            console.log(cliTheme.information('Last activities:'));
            processMatchingData(matchingLastActivities, 'lastActivities', commandOptions);
            if (matchingLastActivities.length > 0) {
              printOutput(matchingLastActivities, commandOptions?.format);
            } else {
              // deno-lint-ignore no-console
              console.log('none');
            }

            // deno-lint-ignore no-console
            console.log(cliTheme.information('Usage:'));
            processMatchingData(matchingUsage, 'usage', commandOptions);
            printOutput(matchingUsage, commandOptions?.format);
          } else {
            // deno-lint-ignore no-console
            console.log(cliTheme.warning('Client not found'));
            Deno.exit(0);
          }
        },
      );
    } else {
      this.showHelp();
      // deno-lint-ignore no-console
      console.log(cliTheme.error('error: You need to provide "--id" or "--name" option to this command'));
      Deno.exit(1);
    }
  });

/**
 * Retrieves users. By default, all users are returned, but you can retrieve a specific user by specifying an ID or name.
 * Required rights: `usermod(all)`, `settings(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_USERS_SORT`, `URBSTAT_USERS_FORMAT`.
 */
cli.command(
  'users',
  "Retrieves users. By default, all users are returned, but you can retrieve a specific user by specifying an ID or name.\nRequired rights: `usermod(all)`, `settings(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_USERS_SORT`, `URBSTAT_USERS_FORMAT`.",
)
  .example('Get all users (uses default options)', 'users')
  .example("Get information for the user named 'admin'", 'user --name "admin"')
  .option('--format <format:usersFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_USERS_FORMAT') })
  .option('--sort <field:usersSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_USERS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of users, 0 means no limit.', { default: 0 })
  .option('--id <Id:integer>', "User's Id Number.", { conflicts: ['name'] })
  .option('--name <name:string>', "User's Name.")
  .action((commandOptions) => {
    makeServerCalls(['users'], commandOptions).then(() => {
      processMatchingData(usersResponse, 'users', commandOptions);
      printOutput(usersResponse, commandOptions?.format);
    });
  });

/**
 * Retrieves groups. By default, UrBackup clients are added to a group with ID 0 and an empty name (empty string).
 * Required rights: `settings(all)`.
 * If the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_GROUPS_SORT`, `URBSTAT_GROUPS_FORMAT`.
 */
cli.command(
  'groups',
  "Retrieves groups. By default, UrBackup clients are added to a group with ID 0 and an empty name (empty string).\nRequired rights: `settings(all)`.\nIf the 'raw' format is specified, output cannot be sorted or filtered, and property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_GROUPS_SORT`, `URBSTAT_GROUPS_FORMAT`.",
)
  .example('Get all groups (uses default options)', 'groups')
  .option('--format <format:groupsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_GROUPS_FORMAT') })
  .option('--sort <field:groupsSortValues>', "Change the sorting order. Ignored with 'raw' output format.", { default: getSettings('URBSTAT_GROUPS_SORT') })
  .option('--reverse', "Reverse the sorting order. Ignored with 'raw' output format.")
  .option('--max <number:integer>', 'Show only <number> of groups, 0 means no limit.', { default: 0 })
  .action((commandOptions) => {
    makeServerCalls(['groups'], commandOptions).then(() => {
      processMatchingData(groupsResponse, 'groups', commandOptions);
      printOutput(groupsResponse, commandOptions?.format);
    });
  });

cli.parse(Deno.args);
