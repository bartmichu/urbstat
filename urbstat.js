import { colors } from '@cliffy/ansi/colors';
import { Command, EnumType } from '@cliffy/command';
import { load } from '@std/dotenv';
import { Secret } from '@cliffy/prompt';
import { Table } from '@cliffy/table';
import { UrbackupServer } from 'urbackup-server-api';

/**
 * A utility class for formatting data into locale-specific, human-readable strings.
 * All formatting is performed using the locale defined by `getSettings('URBSTAT_LOCALE')`.
 *
 * @class
 */
class Formatter {
  /**
   * Formats a Unix timestamp (in seconds) into a locale-specific date-time string.
   *
   * @param {number} secondsSinceEpoch - The number of seconds since the Unix epoch (January 1, 1970).
   * @returns {string} A formatted date-time string.
   */
  static formatDateTime(secondsSinceEpoch) {
    // deno-lint-ignore no-undef
    const instant = Temporal.Instant.fromEpochMilliseconds(secondsSinceEpoch * 1000);
    return instant.toLocaleString(getSettings('URBSTAT_LOCALE'));
  }

  /**
   * Formats a duration in seconds into a locale-specific, human-readable string.
   *
   * @param {number} seconds - The duration in seconds.
   * @param {string} [style='digital'] - The formatting style to use.
   * @returns {string} The formatted duration string.
   */
  static formatDuration(seconds, style = 'digital') {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const formatter = new Intl.DurationFormat(this.locale, { style });

    return formatter.format({ hours, minutes, seconds: remainingSeconds });
  }

  /**
   * Formats a byte count into a human-readable string.
   *
   * @param {number} bytes - The number of bytes.
   * @param {number} [decimals=2] - The number of decimal places to round to.
   * @returns {string} The formatted string.
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const kilo = 1024;
    const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const unitIndex = Math.floor(Math.log(Math.abs(bytes)) / Math.log(kilo));

    return parseFloat((bytes / Math.pow(kilo, unitIndex)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + units[unitIndex];
  }
}

/**
 * Common text style definitions for CLI messages.
 */
const cliTheme = { error: colors.bold.red, warning: colors.yellow, information: colors.blue };

/**
 * Common mappings of properties.
 */
const MAPS = {
  activityCurrent: {
    id: {
      property: 'id',
      header: 'Activity ID',
      table: {
        include: true,
        minWidth: 8,
        maxWidth: 8,
      },
    },
    logId: {
      property: 'logid',
      header: 'Log ID',
    },
    actionCode: {
      property: 'action',
      header: 'Action',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 6,
      },
      inList: true,
    },
    clientId: {
      property: 'clientid',
      header: 'Client ID',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 6,
      },
    },
    clientName: {
      property: 'name',
      header: 'Client Name',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 30,
      },
    },
    eta: {
      property: 'eta_ms',
      header: 'ETA',
      table: {
        include: true,
        minWidth: 8,
        maxWidth: 8,
      },
      normalizer: function (activityItem) {
        return activityItem[this.property] >= 0 ? Formatter.formatDuration(Math.round(activityItem[this.property] / 1000)) : 'n/a';
      },
    },
    progress: {
      property: 'pcdone',
      header: 'Progress',
      table: {
        include: true,
        minWidth: 8,
        maxWidth: 8,
      },
      normalizer: function (activityItem) {
        return activityItem[this.property] >= 0 ? `${activityItem[this.property]}%` : 'n/a';
      },
    },
    bytesDone: {
      property: 'done_bytes',
      header: 'Bytes Done',
      table: {
        include: true,
        minWidth: 10,
        maxWidth: 10,
      },
      normalizer: function (activityItem) {
        return Formatter.formatBytes(activityItem[this.property], 2);
      },
    },
    size: {
      property: 'total_bytes',
      header: 'Size',
      table: {
        include: true,
        minWidth: 10,
        maxWidth: 10,
      },
      normalizer: function (activityItem) {
        return activityItem[this.property] >= 0 ? Formatter.formatBytes(activityItem[this.property], 2) : 'n/a';
      },
    },
    isPaused: {
      property: 'paused',
      header: 'Paused',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 6,
      },
      normalizer: function (activityItem) {
        return activityItem[this.property] === true ? 'yes' : 'no';
      },
    },
    queue: {
      property: 'queue',
      header: 'Queue',
    },
    speedCurrent: {
      property: 'speed_bpms',
      header: 'Speed',
    },
    speedHistory: {
      property: 'past_speed_bpms',
      header: 'Speed History',
    },
    details: {
      property: 'detail_pc',
      header: 'Info',
    },
    detailPc: {
      property: 'details',
      header: 'Details',
    },
  },
  activityLast: {
    id: {
      property: 'id',
      header: 'Activity ID',
      table: {
        include: true,
        minWidth: 8,
        maxWidth: 8,
      },
    },
    clientId: {
      property: 'clientid',
      header: 'Client ID',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 6,
      },
    },
    clientName: {
      property: 'name',
      header: 'Client Name',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 30,
      },
      inList: true,
    },
    startingTime: {
      property: 'backuptime',
      header: 'Starting Time',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 11,
      },
      normalizer: function (activityItem) {
        return Formatter.formatDateTime(activityItem[this.property]);
      },
    },
    duration: {
      property: 'duration',
      header: 'Duration',
      table: {
        include: true,
        minWidth: 8,
        maxWidth: 8,
      },
      normalizer: function (activityItem) {
        return Formatter.formatDuration(activityItem[this.property]);
      },
    },
    delete: {
      property: 'del',
      header: 'Delete',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 6,
      },
      normalizer: function (activityItem) {
        return activityItem[this.property] === true ? 'yes' : 'no';
      },
    },
    size: {
      property: 'size_bytes',
      header: 'Size',
      table: {
        include: true,
        minWidth: 10,
        maxWidth: 10,
      },
      normalizer: function (activityItem) {
        return Formatter.formatBytes(activityItem[this.property], 2);
      },
    },
    incremental: {
      property: 'incremental',
      header: 'Incremental',
    },
    image: {
      property: 'image',
      header: 'Image',
    },
    restore: {
      property: 'restore',
      header: 'Restore',
    },
    resumed: {
      property: 'redumed',
      header: 'Resumed',
    },
    details: {
      property: 'details',
      header: 'Details',
    },
  },
  client: {
    id: {
      property: 'id',
      header: 'Client ID',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 6,
      },
    },
    name: {
      property: 'name',
      header: 'Client Name',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 30,
      },
      inList: true,
    },
    uid: {
      property: 'uid',
      header: 'Client UID',
    },
    groupName: {
      property: 'groupname',
      header: 'Group Name',
    },
    toRemove: {
      property: 'delete_pending',
      header: 'Remove Pending',
      normalizer: function (clientItem) {
        return clientItem[this.property].length === 0 ? 'no' : 'yes';
      },
    },
    isOnline: {
      property: 'online',
      header: 'Online',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 6,
      },
      normalizer: function (clientItem) {
        return clientItem[this.property] === true ? 'yes' : 'no';
      },
    },
    lastSeen: {
      property: 'lastseen',
      header: 'Last Seen',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 11,
      },
      normalizer: function (clientItem) {
        return clientItem[this.property] === 0 ? 'never' : Formatter.formatDateTime(clientItem[this.property]);
      },
    },
    statusFile: {
      property: 'file_ok',
      header: 'File BUP Status',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 8,
      },
      normalizer: function (clientItem) {
        if (clientItem[MAPS.client.isFileDisabled.property] === true) {
          return 'disabled';
        } else if (clientItem[this.property] === true) {
          return clientItem[MAPS.client.issuesFile.property] === 0 ? 'ok' : 'issues';
        } else {
          return 'failed';
        }
      },
    },
    lastFile: {
      property: 'lastbackup',
      header: 'Last File BUP',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 11,
      },
      normalizer: function (clientItem) {
        if (clientItem[this.property] === 0) {
          return clientItem[MAPS.client.isFileDisabled.property] === true ? 'disabled' : 'never';
        } else {
          return Formatter.formatDateTime(clientItem[this.property]);
        }
      },
    },
    issuesFile: {
      property: 'last_filebackup_issues',
      header: 'File BUP Issues',
    },
    isFileDisabled: {
      property: 'file_disabled',
      header: 'File Disabled',
      normalizer: function (clientItem) {
        return clientItem[this.property] === true ? 'yes' : 'no';
      },
    },
    statusImage: {
      property: 'image_ok',
      header: 'Image BUP Status',
      table: {
        include: true,
        minWidth: 6,
        maxWidth: 8,
      },
      normalizer: function (clientItem) {
        if (clientItem[MAPS.client.isImageDisabled.property] === true) {
          return 'disabled';
        } else {
          return clientItem[this.property] === true ? 'ok' : 'failed';
        }
      },
    },
    lastImage: {
      property: 'lastbackup_image',
      header: 'Last Image BUP',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 11,
      },
      normalizer: function (clientItem) {
        if (clientItem[this.property] === 0) {
          return clientItem[MAPS.client.isImageDisabled.property] === true ? 'disabled' : 'never';
        } else {
          return Formatter.formatDateTime(clientItem[this.property]);
        }
      },
    },
    isImageDisabled: {
      property: 'image_disabled',
      header: 'Image Disabled',
      normalizer: function (clientItem) {
        return clientItem[this.property] === true ? 'yes' : 'no';
      },
    },
    activity: {
      property: 'status',
      header: 'Activity',
      table: {
        include: true,
        minWidth: 8,
        maxWidth: 12,
      },
      normalizer: function (clientItem) {
        return clientItem[this.property] === 0 ? 'none' : clientItem[this.property];
      },
    },
    processes: {
      property: 'processes',
      header: 'Processes',
    },
    ip: {
      property: 'ip',
      header: 'IP',
    },
    version: {
      property: 'client_version_string',
      header: 'Client Version',
    },
    osType: {
      property: 'os_simple',
      header: 'OS Type',
    },
    osVersion: {
      property: 'os_version_string',
      header: 'OS Version',
    },
  },
  usage: {
    clientName: {
      property: 'name',
      header: 'Client Name',
      table: {
        include: true,
        minWidth: 11,
        maxWidth: 37,
      },
    },
    file: {
      property: 'files',
      header: 'File Backups',
      table: {
        include: true,
        minWidth: 10,
        maxWidth: 10,
      },
      normalizer: function (usageItem) {
        return Formatter.formatBytes(usageItem[this.property], 2);
      },
    },
    image: {
      property: 'images',
      header: 'Image Backups',
      table: {
        include: true,
        minWidth: 10,
        maxWidth: 10,
      },
      normalizer: function (usageItem) {
        return Formatter.formatBytes(usageItem[this.property], 2);
      },
    },
    used: {
      property: 'used',
      header: 'Total',
      table: {
        include: true,
        minWidth: 10,
        maxWidth: 10,
      },
      inList: true,
      normalizer: function (usageItem) {
        return Formatter.formatBytes(usageItem[this.property], 2);
      },
    },
  },
  group: {
    id: {
      property: 'id',
      header: 'Group ID',
      table: {
        include: true,
        minWidth: 8,
        maxWidth: 8,
      },
    },
    name: {
      property: 'name',
      header: 'Group Name',
      table: {
        include: true,
        minWidth: 10,
        maxWidth: 65,
      },
      inList: true,
    },
  },
  user: {
    id: {
      property: 'id',
      header: 'User ID',
      table: {
        include: true,
        minWidth: 4,
        maxWidth: 4,
      },
    },
    name: {
      property: 'name',
      header: 'User Name',
      table: {
        include: true,
        minWidth: 9,
        maxWidth: 20,
      },
      inList: true,
    },
    rights: {
      property: 'rights',
      header: 'User Rights',
      table: {
        include: true,
        minWidth: 20,
        maxWidth: 46,
      },
      normalizer: function (userItem) {
        return JSON.stringify(userItem[this.property]);
      },
    },
  },
};

/**
 * Hard-coded settings used as a fallback when not found in the configuration file.
 */
const fallbackSettings = {
  URBSTAT_ACTIVITIES_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'list', 'number', 'raw'] },
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
  URBSTAT_USAGE_FORMAT: { defaultValue: 'table', acceptedValues: ['table', 'list', 'number', 'raw'] },
  URBSTAT_USAGE_SORT: { defaultValue: 'name', acceptedValues: ['name', 'file', 'image', 'total'] },
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
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: true,
      })
      : null;

    okClientsResponse = requiredCalls.includes('ok-clients')
      ? await server.getOkClients({
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
        failOnFileIssues: commandOptions?.strict === true,
      })
      : null;

    outdatedClientsResponse = requiredCalls.includes('outdated-clients')
      ? await server.getOutdatedClients({
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
      })
      : null;

    failedClientsResponse = requiredCalls.includes('failed-clients')
      ? await server.getFailedClients({
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
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
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
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
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeFileBackups: commandOptions?.skipFile !== true,
        includeImageBackups: commandOptions?.skipImage !== true,
      })
      : null;

    unseenClientsResponse = requiredCalls.includes('unseen-clients')
      ? await server.getUnseenClients({
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
        timeThreshold: (typeof commandOptions?.threshold === 'number' && commandOptions.threshold >= 0) ? commandOptions.threshold : 0,
      })
      : null;

    removedClientsResponse = requiredCalls.includes('removed-clients') ? await server.getRemovedClients() : null;

    onlineClientsResponse = requiredCalls.includes('online-clients')
      ? await server.getOnlineClients({
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
      })
      : null;

    offlineClientsResponse = requiredCalls.includes('offline-clients')
      ? await server.getOfflineClients({
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
        groupName: commandOptions?.groupName === true ? '' : commandOptions?.groupName,
        includeRemoved: false,
        includeBlank: commandOptions?.skipBlank !== true,
      })
      : null;

    activeClientsResponse = requiredCalls.includes('active-clients')
      ? await server.getActiveClients({
        // TODO: NOTE: This is a workaround for upstream bug that does not allow an empty string as a value https://github.com/c4spar/deno-cliffy/issues/665 https://github.com/c4spar/deno-cliffy/issues/731
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
 * Sorts an array of objects. This function modifies data in place.
 * NOTE: Sorting must be done before plucking.
 *
 * @param {Array} data - The array of data to sort.
 * @param {string} dataType - The type of data being processed.
 * @param {string} sortingOrder - The sorting order key.
 * @param {boolean} isReversed - A flag indicating whether to sort in reverse order.
 */
const sortElements = function (data, dataType, sortingOrder, isReversed) {
  const sortMaps = {
    client: {
      name: MAPS.client.name.property,
      seen: MAPS.client.lastSeen.property,
      file: MAPS.client.lastFile.property,
      image: MAPS.client.lastImage.property,
    },
    activityCurrent: {
      client: MAPS.activityCurrent.clientName.property,
      eta: MAPS.activityCurrent.eta.property,
      progress: MAPS.activityCurrent.progress.property,
      size: MAPS.activityCurrent.size.property,
    },
    activityLast: {
      client: MAPS.activityLast.clientName.property,
      size: MAPS.activityLast.size.property,
      time: MAPS.activityLast.startingTime.property,
      duration: MAPS.activityLast.duration.property,
    },
    usage: {
      name: MAPS.usage.clientName.property,
      file: MAPS.usage.file.property,
      image: MAPS.usage.image.property,
      total: MAPS.usage.used.property,
    },
    user: {
      name: MAPS.user.name.property,
      id: MAPS.user.id.property,
    },
    group: {
      name: MAPS.group.name.property,
      id: MAPS.group.id.property,
    },
  };

  const sortingProperty = sortMaps[dataType][sortingOrder];

  if (typeof sortingProperty === 'undefined') {
    return;
  }

  data.sort((a, b) => {
    const valueA = a[sortingProperty];
    const valueB = b[sortingProperty];

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return valueA.localeCompare(valueB, getSettings('URBSTAT_LOCALE'), { sensitivity: 'base' });
    } else if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueA - valueB;
    }
  });

  if (isReversed === true) {
    data.reverse();
  }
};

/**
 * Plucks a specific property from each element in an array of objects. This function modifies data in place.
 * NOTE: Plucking must be done after sorting.
 *
 * @param {Array} data - The array data to pluck properties from.
 * @param {string} dataType - The type of data being processed.
 * @param {string} outputFormat - The output format.
 */
const pluckProperties = function (data, dataType, outputFormat) {
  const descriptorIndex = Object.values(MAPS[dataType]).findIndex((descriptor) => {
    switch (outputFormat) {
      case 'list':
        return descriptor?.inList === true;
        // break;
      default:
        break;
    }
  });
  const targetProperty = descriptorIndex >= 0 ? Object.values(MAPS[dataType])[descriptorIndex].property : undefined;

  data.forEach((element, index) => {
    data[index] = element[targetProperty];
  });
};

/**
 * Transforms data by sorting, limiting, and plucking it. This function modifies data in place.
 *
 * @param {Array} data - The array of data to be processed.
 * @param {string} dataType - The type of data being processed.
 * @param {object} commandOptions - The options for the command.
 */
const transformData = function (data, dataType, commandOptions) {
  if (commandOptions?.format !== 'number') {
    sortElements(data, dataType, commandOptions?.sort, commandOptions?.reverse);
    data.splice(commandOptions?.max > 0 ? commandOptions.max : data.length);

    if (commandOptions?.format === 'list') {
      pluckProperties(data, dataType, commandOptions?.format);
    }
  }
};

/**
 * Prints data to the console based on the specified format.
 *
 * @param {Array} data - The data to print.
 * @param {string} dataType - The type of data being processed.
 * @param {string} outputFormat - The output format.
 */
const printData = function (data, dataType, outputFormat) {
  switch (outputFormat) {
    case 'list': // NOTE: falls through
    case 'raw':
      // deno-lint-ignore no-console
      console.log(data);
      break;
    case 'number':
      // deno-lint-ignore no-console
      console.log(data.length);
      break;
    case 'table':
      if (data.length > 0) {
        const table = new Table().padding(1).border(true);
        const header = [];

        for (const [elementIndex, element] of data.entries()) {
          const normalizedElement = {};
          let columnIndex = 0;

          for (const [_key, value] of Object.entries(MAPS[dataType])) {
            if (value?.table?.include === true) {
              if (elementIndex === 0) {
                header.push(value?.header ?? '');
                if (value.table?.minWidth > 0) {
                  table.column(columnIndex, { minWidth: value.table.minWidth });
                }
                if (value.table?.maxWidth) {
                  table.column(columnIndex, { maxWidth: value.table.maxWidth });
                }
                columnIndex += 1;
              }

              normalizedElement[value.property] = typeof value?.normalizer === 'function' ? value.normalizer(element) : element[value.property];
            }
          }

          if (Object.keys(normalizedElement).length > 0) {
            table.push(Object.values(normalizedElement));
          }
        }

        table.header(header);
        table.render();
      }
      break;
    default:
      break;
  }
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
 * Get raw response of 'status' API call. Matches all clients, including those marked for removal.
 * Required rights: `status(all)`.
 * Raw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.
 */
cli.command(
  'raw-status',
  "Gets the raw JSON response of the 'status' API call. Matches all clients, including those marked for removal.\nRequired rights: `status(all)`.\nRaw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.",
)
  .example('Get the raw status response', 'raw-status')
  .action((commandOptions) => {
    makeServerCalls(['status'], commandOptions).then(() => {
      printData(statusResponse, '', 'raw');
    });
  });

/**
 * Get raw response of 'activities' API call. Matches all clients, including those marked for removal.
 * Required rights: `progress(all)`, `lastacts(all)`.
 * Raw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.
 */
cli.command(
  'raw-activities',
  "Gets the raw JSON response of the 'activities' API call. Matches all clients, including those marked for removal.\nRequired rights: `progress(all)`, `lastacts(all)`.\nRaw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.",
)
  .example('Get the raw activities response', 'raw-activities')
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
      printData(activitiesResponse, '', 'raw');
    });
  });

/**
 * Get raw response of 'usage' API call. Matches all clients, including those marked for removal.
 * Required rights: `piegraph(all)`.
 * Raw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.
 */
cli.command(
  'raw-usage',
  "Gets the raw JSON response of the 'usage' API cal. Matches all clients, including those marked for removal.\nRequired rights: `piegraph(all)`.\nRaw responses cannot be sorted or filtered. Property names and values are returned as-is from the server.",
)
  .example('Get the raw usage response', 'raw-usage')
  .action((commandOptions) => {
    makeServerCalls(['usage', commandOptions]).then(() => {
      printData(usageResponse, '', 'raw');
    });
  });

/**
 * Retrieves all clients, including those marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`."
 */
cli.command(
  'all-clients',
  "Retrieves all clients, including those marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get all clients (uses default options)', 'all-clients')
  .example('Get the total count of all clients', 'all-clients --format "number"')
  .example('Get all clients as a table, sorted by last file backup time', 'all-clients --format "table" --sort "file"')
  .example('Get all clients as a list, sorted by name in reverse order', 'all-clients --format "list" --sort "name" --reverse')
  .example('Get names of the 3 longest-unseen clients', 'all-clients --format "list" --sort "seen" --max 3')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['all-clients'], commandOptions).then(() => {
      transformData(allClientsResponse, 'client', commandOptions);
      printData(allClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves clients with an 'OK' backup status. File backups finished with issues are treated as OK by default. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli
  .command(
    'ok-clients',
    "Retrieves clients with an 'OK' backup status. File backups finished with issues are treated as OK by default. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
  )
  .example('Get OK clients (uses default options)', 'ok-clients')
  .example('Get the total count of OK clients', 'ok-clients --format "number"')
  .example('Get OK clients as a table, sorted by last file backup time', 'ok-clients --format "table" --sort "file"')
  .example('Get OK clients as a table, sorted by last image backup time, ignoring file backup status', 'ok-clients --format "table" --sort "image" --skip-file')
  .example('Get OK clients as a list, sorted by name in reverse order', 'ok-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--strict', 'Do not treat backups finished with issues as being OK.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['ok-clients'], commandOptions).then(() => {
      transformData(okClientsResponse, 'client', commandOptions);
      printData(okClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves clients running an outdated version of the UrBackup client software. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'outdated-clients',
  "Retrieves clients running an outdated version of the UrBackup client software. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get outdated clients (uses default options)', 'outdated-clients')
  .example('Get the total count of outdated clients', 'outdated-clients --format "number"')
  .example('Get outdated clients as a table, sorted by name', 'outdated-clients --format "table" --sort "name"')
  .example('Get outdated clients as a list, sorted by name in reverse order', 'outdated-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['outdated-clients'], commandOptions).then(() => {
      transformData(outdatedClientsResponse, 'client', commandOptions);
      printData(outdatedClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves clients with a 'failed' backup status or those without a recent backup (as per UrBackup Server settings). File backups finished with issues are treated as OK by default. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'failed-clients',
  "Retrieves clients with a 'failed' backup status or those without a recent backup (as per UrBackup Server settings). File backups finished with issues are treated as OK by default. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get failed clients (uses default options)', 'failed-clients')
  .example('Get the total count of failed clients', 'failed-clients --format "number"')
  .example('Get failed clients as a table, sorted by last file backup time', 'failed-clients --format "table" --sort "file"')
  .example('Get failed clients as a table, sorted by last image backup time, ignoring file backup status', 'failed-clients --format "table" --sort "image" --skip-file')
  .example('Get failed clients as a list, sorted by name in reverse order', 'failed-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
  .option('--strict', 'Do not treat backups finished with issues as being OK.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['failed-clients'], commandOptions).then(() => {
      transformData(failedClientsResponse, 'client', commandOptions);
      printData(failedClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves 'stale' clients, i.e., clients without a recent backup according to the `urbstat` configured threshold. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_STALE`.
 */
cli.command(
  'stale-clients',
  "Retrieves 'stale' clients, i.e., clients without a recent backup according to the `urbstat` configured threshold. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_STALE`.",
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
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', { default: getSettings('URBSTAT_CLIENTS_THRESHOLD_STALE') })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['stale-clients'], commandOptions).then(() => {
      transformData(staleClientsResponse, 'client', commandOptions);
      printData(staleClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves 'blank' clients, i.e., clients that have no completed backups. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'blank-clients',
  "Retrieves 'blank' clients, i.e., clients that have no completed backups. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get blank clients (uses default options)', 'blank-clients')
  .example('Get the total count of blank clients', 'blank-clients --format "number"')
  .example('Get blank clients as a table, sorted by last seen time', 'blank-clients --format "table" --sort "seen"')
  .example('Get blank clients as a table, sorted by name, considering only file backups', 'blank-clients --format "table" --sort "name" --skip-image')
  .example('Get blank clients as a list, sorted by name in reverse order', 'blank-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--skip-file', 'Skip file backups when matching clients.', { conflicts: ['skip-image'] })
  .option('--skip-image', 'Skip image backups when matching clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['blank-clients'], commandOptions).then(() => {
      transformData(blankClientsResponse, 'client', commandOptions);
      printData(blankClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves 'unseen' clients, i.e., clients not seen by the server for a duration exceeding the `urbstat` configured threshold. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_UNSEEN`.
 */
cli
  .command(
    'unseen-clients',
    "Retrieves 'unseen' clients, i.e., clients not seen by the server for a duration exceeding the `urbstat` configured threshold. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`, `URBSTAT_CLIENTS_THRESHOLD_UNSEEN`.",
  )
  .example('Get unseen clients (uses default options)', 'unseen-clients')
  .example('Get the total count of unseen clients', 'unseen-clients --format "number"')
  .example('Get unseen clients as a table, sorted by name', 'unseen-clients --format "table" --sort "name"')
  .example('Get unseen clients as a table, sorted by last seen time, excluding blank clients', 'unseen-clients --format "table" --sort "seen" --skip-blank')
  .example('Get unseen clients as a list, sorted by name in reverse order', 'unseen-clients --format "list" --sort "name" --reverse')
  .example('Get clients not seen for more than 2 days (2880 minutes)', 'unseen-clients --format "table" --sort "name" --threshold 2880')
  .example('Get count of clients not seen for more than 12 hours (720 minutes)', 'unseen-clients --format "number" --threshold 720')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--threshold <minutes:integer>', 'Set time threshold in minutes.', { default: getSettings('URBSTAT_CLIENTS_THRESHOLD_UNSEEN') })
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['unseen-clients'], commandOptions).then(() => {
      transformData(unseenClientsResponse, 'client', commandOptions);
      printData(unseenClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'removed-clients',
  "Retrieves clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get clients marked for removal (uses default options)', 'removed-clients')
  .example('Get the total count of clients marked for removal', 'removed-clients --format "number"')
  .example('Get clients marked for removal as a table, sorted by name', 'removed-clients --format "table" --sort "name"')
  .example('Get clients marked for removal as a list, sorted by name in reverse order', 'removed-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['removed-clients'], commandOptions).then(() => {
      transformData(removedClientsResponse, 'client', commandOptions);
      printData(removedClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves online clients. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'online-clients',
  "Retrieves online clients. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get online clients (uses default options)', 'online-clients')
  .example('Get the total count of online clients', 'online-clients --format "number"')
  .example('Get online clients as a table, sorted by name', 'online-clients --format "table" --sort "name"')
  .example('Get online clients as a table, sorted by name, excluding blank clients', 'online-clients --format "table" --sort "name" --skip-blank')
  .example('Get online clients as a list, sorted by name in reverse order', 'online-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['online-clients'], commandOptions).then(() => {
      transformData(onlineClientsResponse, 'client', commandOptions);
      printData(onlineClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves offline clients. Excludes clients marked for removal.
 * Required rights: `status(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'offline-clients',
  "Retrieves offline clients. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get offline clients (uses default options)', 'offline-clients')
  .example('Get the total count of offline clients', 'offline-clients --format "number"')
  .example('Get offline clients as a table, sorted by name', 'offline-clients --format "table" --sort "name"')
  .example('Get offline clients as a table, sorted by name, excluding blank clients', 'offline-clients --format "table" --sort "name" --skip-blank')
  .example('Get offline clients as a list, sorted by name in reverse order', 'offline-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--skip-blank', 'Skip blank clients.')
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['offline-clients'], commandOptions).then(() => {
      transformData(offlineClientsResponse, 'client', commandOptions);
      printData(offlineClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves currently active clients. Excludes clients marked for removal.
 * Required rights: `status(all)`
 * nIf the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`
 .*/
cli.command(
  'active-clients',
  "Retrieves currently active clients. Excludes clients marked for removal.\nRequired rights: `status(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_CLIENTS_FORMAT`, `URBSTAT_CLIENTS_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get currently active clients (uses default options)', 'active-clients')
  .example('Get the total count of currently active clients', 'active-clients --format "number"')
  .example('Get currently active clients as a table, sorted by name', 'active-clients --format "table" --sort "name"')
  .example('Get currently active clients as a list, sorted by name in reverse order', 'active-clients --format "list" --sort "name" --reverse')
  .option('--format <format:clientsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_CLIENTS_FORMAT') })
  .option('--sort <field:clientsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_CLIENTS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of clients, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--group-name [name:string]', 'Limit clients to specified group only. Use ="" for empty string.', { default: undefined })
  .action((commandOptions) => {
    makeServerCalls(['active-clients'], commandOptions).then(() => {
      transformData(activeClientsResponse, 'client', commandOptions);
      printData(activeClientsResponse, 'client', commandOptions?.format);
    });
  });

/**
 * Retrieves current activities.
 * Required rights: `progress(all)`, `lastacts(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'current-activities',
  "Retrieves current activities.\nRequired rights: `progress(all)`, `lastacts(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.",
)
  .example('Get current activities (uses default options)', 'current-activities')
  .example('Get the total count of current activities', 'current-activities --format "number"')
  .example('Get current activities as a table, sorted by progress', 'current-activities --format "table" --sort "progress"')
  .example('Get current activities as a table, sorted by progress, excluding paused activities', 'current-activities --format "table" --sort "progress" --skip-paused')
  .example('Get the 3 current activities with the longest ETA, sorted descending', 'current-activities --format "table" --sort "eta" --max 3 --reverse')
  .example("Get current activities for client 'office', sorted by ETA", 'current-activities --format "table" --sort "eta" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:currentActivitiesSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_ACTIVITIES_SORT_CURRENT') })
  .option('--reverse', 'Reverse the sorting order. ')
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--skip-paused', 'Skip paused activities.')
  .option('--client-name <name:string>', 'Limit activities to specified client only.')
  .option('--client-id <ID:integer>', 'Limit activities to specified client only.', { conflicts: ['client-name'] })
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
      transformData(activitiesResponse.current, 'activityCurrent', commandOptions);
      printData(activitiesResponse.current, 'activityCurrent', commandOptions?.format);
    });
  });

/**
 * Retrieves recently completed activities.
 * Required rights: `progress(all)`, `lastacts(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.
 */
cli.command(
  'last-activities',
  "Retrieves recently completed activities.\nRequired rights: `progress(all)`, `lastacts(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_LAST`, `URBSTAT_LOCALE`.",
)
  .example('Get last activities (uses default options)', 'last-activities')
  .example('Get the total count of last activities', 'last-activities --format "number"')
  .example('Get last activities as a table, sorted by start time', 'last-activities --format "table" --sort "time"')
  .example('Get the 3 last activities with the largest size, sorted descending', 'last-activities --format "table" --sort "size" --max 3 --reverse')
  .example('Get the 3 last activities with the longest duration, sorted descending', 'last-activities --format "table" --sort "duration" --max 3 --reverse')
  .example("Get last activities for client 'office', sorted by start time", 'last-activities --format "table" --sort "time" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:lastActivitiesSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_ACTIVITIES_SORT_LAST') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--client-name <name:string>', 'Limit activities to specified client only.')
  .option('--client-id <ID:integer>', 'Limit activities to specified client only.', { conflicts: ['client-name'] })
  .action((commandOptions) => {
    makeServerCalls(['activities'], commandOptions).then(() => {
      transformData(activitiesResponse.last, 'activityLast', commandOptions);
      printData(activitiesResponse.last, 'activityLast', commandOptions?.format);
    });
  });

/**
 * Retrieves paused activities.
 * Required rights: `progress(all)`, `lastacts(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'paused-activities',
  "Retrieves paused activities.\nRequired rights: `progress(all)`, `lastacts(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_ACTIVITIES_FORMAT`, `URBSTAT_ACTIVITIES_SORT_CURRENT`, `URBSTAT_LOCALE`.",
)
  .example('Get paused activities (uses default options)', 'paused-activities')
  .example('Get the total count of paused activities', 'paused-activities --format "number"')
  .example('Get paused activities as a table, sorted by progress', 'paused-activities --format "table" --sort "progress"')
  .example('Get the 3 paused activities with the largest size, sorted descending', 'paused-activities --format "table" --sort "size" --max 3 --reverse')
  .example("Get paused activities for client 'office', sorted by client name", 'paused-activities --format "table" --sort "client" --client-name "office"')
  .option('--format <format:activitiesFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_ACTIVITIES_FORMAT') })
  .option('--sort <field:currentActivitiesSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_ACTIVITIES_SORT_CURRENT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of activities, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--client-name <name:string>', 'Limit activities to specified client only.')
  .option('--client-id <ID:integer>', 'Limit activities to specified client only.', { conflicts: ['client-name'] })
  .action((commandOptions) => {
    makeServerCalls(['paused-activities'], commandOptions).then(() => {
      transformData(pausedActivitiesResponse, 'activityCurrent', commandOptions);
      printData(pausedActivitiesResponse, 'activityCurrent', commandOptions?.format);
    });
  });

/**
 * Retrieves storage usage statistics for clients.
 * Required rights: `piegraph(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_USAGE_FORMAT`, `URBSTAT_USAGE_SORT`, `URBSTAT_LOCALE`.
 */
cli.command(
  'usage',
  "Retrieves storage usage statistics for clients.\nRequired rights: `piegraph(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_USAGE_FORMAT`, `URBSTAT_USAGE_SORT`, `URBSTAT_LOCALE`.",
)
  .example('Get storage usage (uses default options)', 'usage')
  .example('Get storage usage as a table, sorted by client name', 'usage --format "table" --sort "name"')
  .example('Get the 3 clients with the largest storage usage, sorted descending', 'usage --format "table" --sort "total" --max 3 --reverse')
  .example("Get storage usage for client 'office'", 'usage --format "table" --client-name "office"')
  .option('--format <format:usageFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_USAGE_FORMAT') })
  .option('--sort <field:usageSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_USAGE_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of elements, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .option('--client-name <name:string>', 'Limit usage to specified client only.', { default: '' })
  .action((commandOptions) => {
    makeServerCalls(['usage'], commandOptions).then(() => {
      transformData(usageResponse, 'usage', commandOptions);
      printData(usageResponse, 'usage', commandOptions?.format);
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
  .option('--id <ID:integer>', "Client's ID Number.", { conflicts: ['name'] })
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
            transformData(matchingClient, 'client', commandOptions);
            printData(matchingClient, 'client', commandOptions?.format);

            // deno-lint-ignore no-console
            console.log(cliTheme.information('Current activities:'));
            transformData(matchingCurrentActivities, 'activityCurrent', commandOptions);
            if (matchingCurrentActivities.length > 0) {
              printData(matchingCurrentActivities, 'activityCurrent', commandOptions?.format);
            } else {
              if (commandOptions?.format !== 'raw') {
                // deno-lint-ignore no-console
                console.log('none');
              }
            }

            // deno-lint-ignore no-console
            console.log(cliTheme.information('Last activities:'));
            transformData(matchingLastActivities, 'activityLast', commandOptions);
            if (matchingLastActivities.length > 0) {
              printData(matchingLastActivities, 'activityLast', commandOptions?.format);
            } else {
              // deno-lint-ignore no-console
              console.log('none');
            }

            // deno-lint-ignore no-console
            console.log(cliTheme.information('Usage:'));
            transformData(matchingUsage, 'usage', commandOptions);
            printData(matchingUsage, 'usage', commandOptions?.format);
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
 * Retrieves all users along with their rights.
 * Required rights: `usermod(all)`, `settings(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_USERS_SORT`, `URBSTAT_USERS_FORMAT`.
 */
cli.command(
  'users',
  "Retrieves all users along with their rights.\nRequired rights: `usermod(all)`, `settings(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_USERS_SORT`, `URBSTAT_USERS_FORMAT`.",
)
  .example('Get all users (uses default options)', 'users')
  .option('--format <format:usersFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_USERS_FORMAT') })
  .option('--sort <field:usersSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_USERS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of users, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .action((commandOptions) => {
    makeServerCalls(['users'], commandOptions).then(() => {
      transformData(usersResponse, 'user', commandOptions);
      printData(usersResponse, 'user', commandOptions?.format);
    });
  });

/**
 * Retrieves all groups. By default, UrBackup clients are added to a group with ID 0 and an empty name (empty string).
 * Required rights: `settings(all)`.
 * If the 'raw' format is specified, property names and values are returned as-is.
 * Default options are configured using: `URBSTAT_GROUPS_SORT`, `URBSTAT_GROUPS_FORMAT`.
 */
cli.command(
  'groups',
  "Retrieves all groups. By default, UrBackup clients are added to a group with ID 0 and an empty name (empty string).\nRequired rights: `settings(all)`.\nIf the 'raw' format is specified, property names and values are returned as-is.\nDefault options are configured using: `URBSTAT_GROUPS_SORT`, `URBSTAT_GROUPS_FORMAT`.",
)
  .example('Get all groups (uses default options)', 'groups')
  .option('--format <format:groupsFormatValues>', 'Change the output format.', { default: getSettings('URBSTAT_GROUPS_FORMAT') })
  .option('--sort <field:groupsSortValues>', 'Change the sorting order.', { default: getSettings('URBSTAT_GROUPS_SORT') })
  .option('--reverse', 'Reverse the sorting order.')
  .option('--max <number:integer>', 'Show only <number> of groups, 0 means no limit. Ignored for "raw" format.', { default: 0 })
  .action((commandOptions) => {
    makeServerCalls(['groups'], commandOptions).then(() => {
      transformData(groupsResponse, 'group', commandOptions);
      printData(groupsResponse, 'group', commandOptions?.format);
    });
  });

cli.parse(Deno.args);
