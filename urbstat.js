// import { assertEquals } from "std/testing/assert.ts";
// assertEquals(1, 2);

import UrbackupServer from './module/urbackup-server-lite.js';
import { config } from 'std/dotenv/mod.ts';
import { Command, EnumType } from 'cliffy/command/mod.ts';
import { Table } from 'cliffy/table/mod.ts';
import { colors } from "cliffy/ansi/colors.ts";
import ms from 'ms/';


/**
 * Application name. Used in auto-generated help etc.
 */
const programName = 'urbstat';


/**
 * Hard-coded configuration values used as a fallback when not found in config files.
 */
const configFallback = {
  // DevSkim: ignore DS137138
  URBSTAT_SERVER_URL: { defaultValue: 'http://127.0.0.1:55414' },
  URBSTAT_SERVER_USERNAME: { defaultValue: 'admin' },
  URBSTAT_SERVER_PASSWORD: { defaultValue: '' },
  URBSTAT_THRESHOLD_STALE_FILE: { defaultValue: 7200 },
  URBSTAT_THRESHOLD_STALE_IMAGE: { defaultValue: 7200 },
  URBSTAT_THRESHOLD_VOID_CLIENT: { defaultValue: 10080 },
  URBSTAT_LOCALE: { defaultValue: 'en' },
  URBSTAT_CLIENTS_FORMAT: {
    defaultValue: 'table',
    recognizedValues: ['table', 'list', 'number', 'raw']
  },
  URBSTAT_CLIENTS_SORT: {
    defaultValue: 'name',
    recognizedValues: ['name', 'seen', 'file', 'image']
  },
  URBSTAT_ACTIVITIES_FORMAT: {
    defaultValue: 'table',
    recognizedValues: ['table', 'number', 'raw']
  },
  URBSTAT_ACTIVITIES_SORT_CURRENT: {
    defaultValue: 'client',
    recognizedValues: ['client', 'eta', 'progress', 'size']
  },
  URBSTAT_ACTIVITIES_SORT_LAST: {
    defaultValue: 'time',
    recognizedValues: ['client', 'time', 'duration', 'size']
  },
  URBSTAT_CLIENT_FORMAT: {
    defaultValue: 'info',
    recognizedValues: ['info', 'raw']
  },
};


/**
 * Common font and style definitions.
 */
const cliTheme = {
  error: colors.bold.red,
  warning: colors.yellow,
  information: colors.blue
};


/**
 * Configuration data loaded from '.env' and '.env.defaults' files.
 */
const configData = await config({
  export: false,
  allowEmptyValues: false,
});


// TODO convert to iife
const getConfigValue = function (key) {
  if (key in configFallback) {
    // console.debug(key);
    return configData[key] ?? configFallback[key].defaultValue;
  } else {
    // TODO
    console.debug('BAR');
  }
};


/**
 * Instance of UrBackup Server.
 */
const server = new UrbackupServer({
  url: getConfigValue('URBSTAT_SERVER_URL'),
  username: getConfigValue('URBSTAT_SERVER_USERNAME'),
  password: getConfigValue('URBSTAT_SERVER_PASSWORD')
});


// NOTE: Convertion is needed as UrBackup/Python uses seconds for timestamps whereas Javascript uses milliseconds
const currentEpochTime = Math.round(new Date().getTime() / 1000.0);


let statusResponse;
let activitiesResponse;
let usageResponse;


/**
 * Make required API calls to UrBackup Server. Exits with error code when unsuccessful.
 */
async function makeServerCalls(requiredCalls, extraArguments) {
  try {
    statusResponse = requiredCalls.includes('status') ? await server.getStatus({ includeRemoved: false, clientId: extraArguments?.clientId, clientName: extraArguments?.clientName }) : null;
    activitiesResponse = requiredCalls.includes('activities') ? await server.getActivities({ includeCurrent: true, includePast: true }) : null;
    usageResponse = requiredCalls.includes('usage') ? await server.getUsage() : null;
  } catch (e) {
    console.error(cliTheme.error(e.message));
    Deno.exit(1);
  }
}


/**
 * Normalize client object for further use in application.
 */
const normalizeClient = function (client, format) {
  if (format === 'raw') {
    return client;
  } else {
    return (function ({ id, name, file_ok, file_disabled, last_filebackup_issues, lastbackup, image_ok, image_disabled, last_imagebackup_issues, lastbackup_image, online, lastseen, status }) { // eslint-disable-line camelcase

      // TODO file_disabled, last_imagebackup_issues ??
      if (file_disabled === true) {
        file_ok = 'disabled';
      } else if (file_ok === true) {
        file_ok = last_filebackup_issues === 0 ? 'ok' : 'issues';
      } else {
        // TODO no recent === failed?
        file_ok = 'failed';
      }

      if (image_disabled === true) {
        image_ok = 'disabled';
      } else if (image_ok === true) {
        image_ok = last_imagebackup_issues === 0 ? 'ok' : 'issues';
      } else {
        // TODO no recent === failed?
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
        Activity: status
      });
    })(client);
  }
};


/**
 * Normalize activity object for further use in application.
 */
const normalizeActivity = function (activity, last, format) {
  switch (format) {
    case 'table':
      if (last === true) {
        return (function ({ clientid, name, id, duration, size_bytes, backuptime }) { // eslint-disable-line camelcase
          return ({
            'Activity Id': id,
            'Client Id': clientid,
            'Client Name': name,
            Duration: duration,
            Size: activity.del === true ? size_bytes * -1 : size_bytes,
            'Starting Time': backuptime
          });
        })(activity);
      } else {
        return (function ({ clientid, name, action, paused, pcdone, queue, done_bytes, total_bytes, eta_ms }) { // eslint-disable-line camelcase
          return ({
            'Client Id': clientid,
            'Client Name': name,
            Action: action,
            Paused: paused === true ? 'yes' : 'no',
            Progress: pcdone,
            Queue: queue,
            // TODO
            'Bytes Done': activity.del === true ? done_bytes * -1 : done_bytes,
            Size: total_bytes,
            ETA: eta_ms
          });
        })(activity);
      }
    case 'number':
      return activity.id;
    case 'raw':
      return activity;
  }
};


/**
 * Sort clients. This function sorts the elements of an array in place.
 * NOTE: Sorting must be done after normalization.
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


const printOutput = function (data, format) {
  const formatBytes = function (bytes, decimals = 2) {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const kilo = 1024;
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const unitIndex = Math.floor(Math.log(Math.abs(bytes)) / Math.log(kilo));

    return parseFloat((bytes / Math.pow(kilo, unitIndex)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + units[unitIndex];
  };

  for (const element in data) {
    Object.keys(data[element]).forEach(function (key) {
      switch (key) {
        case 'Bytes Done':
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
          data[element][key] = `${data[element][key]}%`
          break;
      }
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
 * Process clients i.e. normalize, sort and limit. This function changes elements of an array in place.
 */
const processMatchingClients = function (clients, commandOptions) {
  clients.forEach((client, index) => {
    clients[index] = normalizeClient(client, commandOptions?.format);
  });

  if (commandOptions.format !== 'raw') {
    sortClients(clients, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
  }

  clients.splice(commandOptions?.max > 0 ? commandOptions.max : clients.length);

  clients.forEach((client, index) => {
    switch (commandOptions?.format) {
      case 'list':
      /* falls through */
      case 'number':
        clients[index] = client['Client Name'];
        break;
    }
  })
};


/**
 * Process activities i.e. normalize, sort and limit. This function changes elements of an array in place.
 */
const processMatchingActivities = function (activities, last, commandOptions) {
  activities.forEach((activity, index) => {
    activities[index] = normalizeActivity(activity, last, commandOptions?.format);
  });

  if (commandOptions.format !== 'raw') {
    sortActivities(activities, last, commandOptions?.format, commandOptions?.sort, commandOptions?.reverse);
  }

  activities.splice(commandOptions?.max > 0 ? commandOptions.max : activities.length);

  activities.forEach((activity, index) => {
    switch (commandOptions?.format) {
      case 'number':
        activities[index] = activity['Activity Id'];
        break;
    }
  })

  // TODO dodać zmiany wprowadzone dla klientów
}


/**
 * Main command.
 */
const cli = await new Command()
  .name(programName)
  .version('0.0.1')
  .description('The Missing Command-line Tool for UrBackup Server')
  .example('Get failed clients', `${programName} get-failed-clients`)
  .example('Get options and detailed help for specific command', `${programName} get-failed-clients --help`)
  .globalType('clientsFormatValues', new EnumType(configFallback.URBSTAT_CLIENTS_FORMAT.recognizedValues))
  .globalType('clientsSortValues', new EnumType(configFallback.URBSTAT_CLIENTS_SORT.recognizedValues))
  .globalType('activitiesFormatValues', new EnumType(configFallback.URBSTAT_ACTIVITIES_FORMAT.recognizedValues))
  .globalType('currentActivitiesSortValues', new EnumType(configFallback.URBSTAT_ACTIVITIES_SORT_CURRENT.recognizedValues))
  .globalType('lastActivitiesSortValues', new EnumType(configFallback.URBSTAT_ACTIVITIES_SORT_LAST.recognizedValues))
  .globalType('clientFormatValues', new EnumType(configFallback.URBSTAT_CLIENT_FORMAT.recognizedValues))
  .action(() => {
    cli.showHelp();
    Deno.exit(0);
  });


cli.command('get-raw-status', 'Get raw response of "status" API call.\nRequired rights: status(all).\nRaw responses can not be sorted, filtered etc. Property names and values are left unaltered.')
  .example('Get raw response', `${programName} get-raw-status`)
  .action(() => {
    makeServerCalls(['status']).then(() => {
      printOutput(statusResponse, 'raw');
    });
  });


cli.command('get-raw-activities', 'Get raw response of "activities" API call.\nRequired rights: progress(all), lastacts(all).\nRaw responses can not be sorted, filtered etc. Property names and values are left unaltered.')
  .example('Get raw response', `${programName} get-raw-activities`)
  .action(() => {
    makeServerCalls(['activities']).then(() => {
      printOutput(activitiesResponse, 'raw');
    });
  });


cli.command('get-all-clients', 'Get all clients.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('Get all clients with default options', `${programName} get-all-clients`)
  .example('Get the total number of all clients', `${programName} get-all-clients --format "number"`)
  .example('Get a table with all clients sorted by last file backup time', `${programName} get-all-clients --format "table" --sort "file"`)
  .example('Get names of all clients in reverse order', `${programName} get-all-clients --format "list" --sort "name" --reverse`)
  .example('Get names of three of the longest-unseen clients', `${programName} get-all-clients --format "list" --sort "seen" --max 3`)
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        matchingClients.push(client);
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli
  .command('get-ok-clients', 'Get OK clients i.e. clients with OK backup status.\nBackups finished with issues are treated as OK by default.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .option('--skip-file', 'Skip file backups when matching clients.')
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--strict', 'Do not treat backups finished with issues as being OK.')
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        if (commandOptions.skipFile !== true) {
          if (client.file_disabled !== true && client.file_ok === true) {
            if (commandOptions?.strict !== true || (commandOptions?.strict === true && client.last_filebackup_issues === 0)) {
              matchingClients.push(client);
              continue;
            }
          }
        }

        if (commandOptions.skipImage !== true) {
          if (client.image_disabled !== true && client.image_ok === true) {
            matchingClients.push(client);
            continue;
          }
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli.command('get-failed-clients', 'Get failed clients i.e. clients with failed backup status or without a recent backup as configured in UrBackup Server.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .option('--skip-file', 'Skip file backups when matching clients.')
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        if (commandOptions.skipFile !== true) {
          if ((commandOptions.skipBlank !== true || (commandOptions.skipBlank === true && client.lastbackup !== 0)) && client.file_disabled !== true && client.file_ok !== true) {
            matchingClients.push(client);
            continue;
          }
        }

        if (commandOptions.skipImage !== true) {
          if ((commandOptions.skipBlank !== true || (commandOptions.skipBlank === true && client.lastbackup_image !== 0)) && client.image_disabled !== true && client.image_ok !== true) {
            matchingClients.push(client);
            continue;
          }
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli.command('get-stale-clients', `Get stale clients i.e. clients without a recent backup as configured in ${programName}.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.`)
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .option('--threshold-file <minutes:integer>', 'Set time threshold in minutes.', {
    default: getConfigValue('URBSTAT_THRESHOLD_STALE_FILE')
  })
  .option('--threshold-image <minutes:integer>', 'Set time threshold in minutes.', {
    default: getConfigValue('URBSTAT_THRESHOLD_STALE_IMAGE')
  })
  .option('--skip-file', 'Skip file backups when matching clients.')
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        if (commandOptions.skipFile !== true) {
          const timestampDifference = Math.round((currentEpochTime - (client?.lastbackup ?? 0)) / 60);
          if ((commandOptions.skipBlank !== true || (commandOptions.skipBlank === true && client.lastbackup !== 0)) && client.file_disabled !== true && timestampDifference >= commandOptions.thresholdFile) {
            matchingClients.push(client);
            continue;
          }
        }

        if (commandOptions.skipImage !== true) {
          const timestampDifference = Math.round((currentEpochTime - (client?.lastbackup_image ?? 0)) / 60);
          if ((commandOptions.skipBlank !== true || (commandOptions.skipBlank === true && client.lastbackup_image !== 0)) && client.image_disabled !== true && timestampDifference >= commandOptions.thresholdImage) {
            matchingClients.push(client);
            continue;
          }
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli.command('get-blank-clients', 'Get blank clients i.e. clients without any finished backups.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .option('--skip-file', 'Skip file backups when matching clients.')
  .option('--skip-image', 'Skip image backups when matching clients.')
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        if (commandOptions.skipFile !== true) {
          if (client.file_disabled !== true && client.lastbackup === 0) {
            matchingClients.push(client);
            continue;
          }
        }

        if (commandOptions.skipImage !== true) {
          if (client.image_disabled !== true && client.lastbackup_image === 0) {
            matchingClients.push(client);
            continue;
          }
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli
  .command('get-void-clients', `Get void clients i.e. clients not seen for a long time as configured in ${programName}.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.`)
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', {
    default: getConfigValue('URBSTAT_THRESHOLD_VOID_CLIENT')
  })
  .option('--skip-blank', 'Skip blank clients.')
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        const timestampDifference = Math.round((currentEpochTime - (client?.lastseen ?? 0)) / 60);
        if (timestampDifference >= commandOptions.threshold) {
          if (commandOptions.skipBlank === true && client.file_disabled !== true && client.lastbackup === 0) {
            continue;
          }

          if (commandOptions.skipBlank === true && client.image_disabled !== true && client.lastbackup_image === 0) {
            continue;
          }

          matchingClients.push(client);
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli.command('get-online-clients', 'Get online clients.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .option('--skip-blank', 'Skip blank clients.')
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        if ((commandOptions.skipBlank !== true || (commandOptions.skipBlank === true && client.lastbackup !== 0)) && (client.online === true)) {
          matchingClients.push(client);
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli.command('get-offline-clients', 'Get offline clients.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .option('--skip-blank', 'Skip blank clients.')
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        if ((commandOptions.skipBlank !== true || (commandOptions.skipBlank === true && client.lastbackup !== 0)) && (client.online === false)) {
          matchingClients.push(client);
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli.command('get-active-clients', 'Get currently active clients.\nRequired rights: status(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_FORMAT')
  })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_CLIENTS_SORT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit.', {
    default: 0
  })
  .action((commandOptions) => {
    makeServerCalls(['status']).then(() => {
      const matchingClients = [];

      for (const client of statusResponse) {
        if (client.status !== 0) {
          matchingClients.push(client);
        }
      }

      processMatchingClients(matchingClients, commandOptions);
      printOutput(matchingClients, commandOptions?.format);
    });
  });


cli.command('get-current-activities', 'Get current activities.\nRequired rights: progress(all), lastacts(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT')
  })
  .option('--sort <field:currentActivitiesSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_SORT_CURRENT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format. ')
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', {
    default: 0
  })
  .option('--skip-paused', 'Skip paused activities.')
  .option('--limit-client <name:string>', 'Limit activities to specified client only.', {
    default: ''
  })
  .action((commandOptions) => {
    makeServerCalls(['activities']).then(() => {
      const matchingActivities = [];

      for (const activity of activitiesResponse.current) {
        if (commandOptions.skipPaused !== true || (commandOptions.skipPaused === true && activity.paused !== true)) {
          if (commandOptions.limitClient.length > 0 && activity.name !== commandOptions.limitClient) {
            continue;
          }

          matchingActivities.push(activity);
        }
      }

      processMatchingActivities(matchingActivities, false, commandOptions);
      printOutput(matchingActivities, commandOptions?.format);
    });
  });


cli.command('get-last-activities', 'Get last activities.\nRequired rights: progress(all), lastacts(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT')
  })
  .option('--sort <field:lastActivitiesSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_SORT_LAST')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', {
    default: 0
  })
  .option('--limit-client <name:string>', 'Limit activities to specified client only.', {
    default: ''
  })
  .action((commandOptions) => {
    makeServerCalls(['activities']).then(() => {
      const matchingActivities = [];

      for (const activity of activitiesResponse.past) {
        if (commandOptions.limitClient.length > 0 && activity.name !== commandOptions.limitClient) {
          continue;
        }

        matchingActivities.push(activity);
      }

      processMatchingActivities(matchingActivities, true, commandOptions);
      printOutput(matchingActivities, commandOptions?.format);
    });
  });


cli.command('get-paused-activities', 'Get paused activities.\nRequired rights: progress(all), lastacts(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT')
  })
  .option('--sort <field:currentActivitiesSortValues>', 'Change the sorting order. Ignored with \'raw\' output format.', {
    default: getConfigValue('URBSTAT_ACTIVITIES_SORT_CURRENT')
  })
  .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', {
    default: 0
  })
  .option('--limit-client <name:string>', 'Limit activities to specified client only.', {
    default: ''
  })
  .action((commandOptions) => {
    makeServerCalls(['activities']).then(() => {
      const matchingActivities = [];

      for (const activity of activitiesResponse.current) {
        if (activity.paused === true) {
          if (commandOptions.limitClient.length > 0 && activity.name !== commandOptions.limitClient) {
            continue;
          }

          matchingActivities.push(activity);
        }
      }

      processMatchingActivities(matchingActivities, false, commandOptions);
      printOutput(matchingActivities, commandOptions?.format);
    });
  });


cli.command('get-client', 'Get detailed information about one client.\nRequired rights: status(all), progress(all), lastacts(all).\nIf you specify "raw" format then output can not be sorted or filtered and property names/values are left unaltered.')
  .example('TODO', '')
  .option('--format <format:clientFormatValues>', 'Change the output format.', {
    default: getConfigValue('URBSTAT_CLIENT_FORMAT')
  })
  .option('--client-id <Id:integer>', 'Client\'s Id Number.')
  .option('--client-name <name:string>', 'Client\'s Name.')
  .action(function (commandOptions) {
    // NOTE: don't use arrow function here (this)
    const extraArguments = {};
    if (commandOptions?.clientId > 0) {
      extraArguments.clientId = commandOptions.clientId;
    } else if (commandOptions?.clientName?.length > 0) {
      extraArguments.clientName = commandOptions.clientName;
    }

    if (Object.keys(extraArguments).length > 0) {
      makeServerCalls(['status', 'activities', 'usage'], extraArguments).then(() => {
        const matchingClient = statusResponse[0];
        if (typeof matchingClient !== 'undefined' && matchingClient?.id > 0) {
          const matchingClientId = matchingClient.id;
          console.log(matchingClient);
          // processMatchingClients([matchingClient], commandOptions);

          const matchingCurrentActivities = activitiesResponse.current.filter(activity => activity.clientid === matchingClientId);
          console.log(matchingCurrentActivities);
          // processMatchingActivities(matchingCurrentActivities, false, commandOptions);

          const matchingLastActivities = activitiesResponse.past.filter(activity => activity.clientid === matchingClientId);
          console.log(matchingLastActivities);
          // processMatchingActivities(matchingPastActivities, true, commandOptions);

          const matchingUsage = usageResponse.find(element => element.name === matchingClient.name);
          console.log(matchingUsage);
        } else {
          console.log(cliTheme.warning('Client not found'));
          Deno.exit(1);
        }
      });
    } else {
      this.showHelp();
      console.log(cliTheme.error('error: You need to provide "--client-id" or "--client-name" option to this command'));
      Deno.exit(1);
    }
  });


cli.command('get-usage', 'TODO')
  .example('TODO', '')
  // .option('--format <format:activitiesFormatValues>', 'Change the output format.', {
  //   default: getConfigValue('URBSTAT_ACTIVITIES_FORMAT')
  // })
  // .option('--sort <field:currentActivitiesSortValues>', 'Change the sorting order.  Ignored with \'raw\' output format.', {
  //   default: getConfigValue('URBSTAT_ACTIVITIES_SORT_CURRENT')
  // })
  // .option('--reverse', 'Reverse the sorting order. Ignored with \'raw\' output format.')
  // .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit.', {
  //   default: 0
  // })
  // .option('--client-name <name:string>', 'Limit activities to specified client only.', {
  //   default: ''
  // })
  .action((commandOptions) => {
    makeServerCalls(['usage']).then(() => {
      // TODO
      console.debug(usageResponse);
    });
  });


cli.parse(Deno.args);
