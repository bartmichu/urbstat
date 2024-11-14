import { pbkdf2 } from 'node:crypto';
import { createHash } from 'node:crypto';

/**
 * Represents a UrBackup Server.
 */
export default class UrbackupServer {
  #isLoggedIn = false;
  #lastLogId = new Map();
  #password;
  #sessionId = '';
  #url;
  #username;

  /**
   * @class
   * @param {Object} [params] - (Optional) An object containing parameters.
   * @param {string} [params.url] - (Optional) Server's URL. Must include protocol, hostname and port. Defaults to http://127.0.0.1:55414.
   * @param {string} [params.username] - (Optional) Username used to log in. Defaults to empty string. Anonymous login is used if userneme is empty.
   * @param {string} [params.password] - (Optional) Password used to log in. Defaults to empty string.
   * @example <caption>Connect locally to the built-in server without password</caption>
   * const server = new UrbackupServer();
   * @example <caption>Connect locally with password</caption>
   * const server = new UrbackupServer({ url: 'http://127.0.0.1:55414', username: 'admin', password: 'secretpassword'});
   * @example <caption>Connect over the network</caption>
   * const server = new UrbackupServer({ url: 'https://192.168.0.2:443', username: 'admin', password: 'secretpassword'});
   */
  constructor(
    { url = 'http://localhost:55414', username = '', password = '' } = {},
  ) {
    this.#url = new URL(url);
    this.#url.pathname = 'x';
    this.#username = username;
    this.#password = password;
  }

  /**
   * This method is not meant to be used outside the class.
   * Used internally to clear session ID and logged-in flag.
   */
  #clearLoginStatus() {
    this.#sessionId = '';
    this.#isLoggedIn = false;
  }

  /**
   * This method is not meant to be used outside the class.
   * Used internally to make API call to the server.
   *
   * @param {string} action - Action.
   * @param {Object} [bodyParams] - Action parameters.
   * @returns {Object} Response body text parsed as JSON.
   */
  async #fetchJson(action = '', bodyParams = {}) {
    this.#url.searchParams.set('a', action);

    if (this.#sessionId.length > 0) {
      bodyParams.ses = this.#sessionId;
    }

    const response = await fetch(this.#url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: new URLSearchParams(bodyParams),
    });

    if (response?.ok === true) {
      return response.json();
    } else {
      throw new Error(
        'Fetch request did not end normally, response was unsuccessful (status not in the range 200-299)',
      );
    }
  }

  /**
   * This method is not meant to be used outside the class.
   * Used internally to hash user password.
   *
   * @param {string} salt - PBKDF2 salt value as stored on the server.
   * @param {number} rounds - PBKDF2 iterations number.
   * @param {string} randomKey - Random key generated by the server for each session.
   * @returns {string} Hashed password.
   */
  async #hashPassword(salt = '', rounds = 10000, randomKey = '') {
    /**
     * @param {string} password - Password.
     * @returns {Buffer} Derived key.
     */
    function pbkdf2Async(password) {
      return new Promise((resolve, reject) => {
        pbkdf2(password, salt, rounds, 32, 'sha256', (error, key) => {
          return error ? reject(error) : resolve(key);
        });
      });
    }

    let passwordHash = createHash('md5').update(salt + this.#password, 'utf8')
      .digest();
    let derivedKey;

    if (rounds > 0) {
      derivedKey = await pbkdf2Async(passwordHash);
    }
    passwordHash = createHash('md5').update(
      randomKey + (rounds > 0 ? derivedKey.toString('hex') : passwordHash),
      'utf8',
    ).digest('hex');

    return passwordHash;
  }

  /**
   * This method is not meant to be used outside the class.
   * Used internally to log in to the server.
   * If username is empty then anonymous login method is used.
   *
   * @returns {boolean} Boolean true if logged in successfuly or was already logged in.
   */
  async #login() {
    // TODO: Use semaphore to prevent race condition with login status i.e. this.#sessionId
    if (this.#isLoggedIn === true && this.#sessionId.length > 0) {
      return true;
    }

    if (this.#username.length === 0) {
      const anonymousLoginResponse = await this.#fetchJson('login');

      if (anonymousLoginResponse?.success === true) {
        this.#sessionId = anonymousLoginResponse.session;
        this.#isLoggedIn = true;
        return true;
      } else {
        this.#clearLoginStatus();
        throw new Error('Anonymous login failed');
      }
    } else {
      const saltResponse = await this.#fetchJson('salt', {
        username: this.#username,
      });

      if (typeof saltResponse?.salt === 'string') {
        this.#sessionId = saltResponse.ses;
        const hashedPassword = await this.#hashPassword(
          saltResponse.salt,
          saltResponse.pbkdf2_rounds,
          saltResponse.rnd,
        );
        const userLoginResponse = await this.#fetchJson('login', {
          username: this.#username,
          password: hashedPassword,
        });

        if (userLoginResponse?.success === true) {
          this.#isLoggedIn = true;
          return true;
        } else {
          // invalid password
          this.#clearLoginStatus();
          throw new Error('Login failed: invalid username or password');
        }
      } else {
        // invalid username
        this.#clearLoginStatus();
        throw new Error('Login failed: invalid username or password');
      }
    }
  }

  /**
   * This method is not meant to be used outside the class.
   * Used internally to map client name to client ID.
   *
   * @param {string} clientName - Client's name.
   * @returns {number} Client's ID. 0 (zero) when no matching clients found.
   */
  async #getClientId(clientName) {
    if (typeof clientName === 'undefined') {
      throw new Error('API call error: missing or invalid parameters');
    }

    const defaultReturnValue = 0;
    const clients = await this.getClients({ includeRemoved: true });
    const clientId = clients.find((client) => client.name === clientName)?.id;

    return typeof clientId === 'undefined' ? defaultReturnValue : clientId;
  }

  /**
   * This method is not meant to be used outside the class.
   * Used internally to map client ID to client name.
   *
   * @param {string} clientId - Client's ID.
   * @returns {string} Client's name. Empty string when no matching clients found.
   */
  async #getClientName(clientId) {
    if (typeof clientId === 'undefined') {
      throw new Error('API call error: missing or invalid parameters');
    }

    const defaultReturnValue = '';
    const clients = await this.getClients({ includeRemoved: true });
    const clientName = clients.find((client) => client.id === clientId)?.name;

    return typeof clientName === 'undefined' ? defaultReturnValue : clientName;
  }

  /**
   * Retrieves server identity.
   *
   * @returns {string} Server identity.
   * @example <caption>Get server identity</caption>
   * server.getServerIdentity().then(data => console.log(data));
   */
  async getServerIdentity() {
    const login = await this.#login();

    if (login === true) {
      const statusResponse = await this.#fetchJson('status');

      if (typeof statusResponse?.server_identity === 'string') {
        return statusResponse.server_identity;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves a list of users.
   *
   * @returns {Array} Array of objects representing users. Empty array when no users found.
   * @example <caption>Get all users</caption>
   * server.getUsers().then(data => console.log(data));
   */
  async getUsers() {
    const login = await this.#login();

    if (login === true) {
      const usersResponse = await this.#fetchJson('settings', {
        sa: 'listusers',
      });

      if (Array.isArray(usersResponse?.users)) {
        return usersResponse.users;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves a list of groups.
   * By default, UrBackup clients are added to a group id 0 with name '' (empty string).
   *
   * @returns {Array} Array of objects representing groups. Empty array when no groups found.
   * @example <caption>Get all groups</caption>
   * server.getGroups().then(data => console.log(data));
   */
  async getGroups() {
    const login = await this.#login();

    if (login === true) {
      const settingsResponse = await this.#fetchJson('settings');

      if (Array.isArray(settingsResponse?.navitems?.groups)) {
        return settingsResponse.navitems.groups;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves a list of clients.
   * Matches all clients by default, including clients marked for removal.
   *
   * @param {Object} [params] - (Optional) An object containing parameters.
   * @param {string} [params.groupName] - (Optional) Group name, case sensitive. By default, UrBackup clients are added to group id 0 with name '' (empty string). Defaults to undefined, which matches all groups.
   * @param {boolean} [params.includeRemoved] - (Optional) Whether or not clients pending deletion should be included. Defaults to true.
   * @returns {Array} Array of objects representing clients matching search criteria. Empty array when no matching clients found.
   * @example <caption>Get all clients</caption>
   * server.getClients().then(data => console.log(data));
   * @example <caption>Get all clients, but skip clients marked for removal</caption>
   * server.getClients({includeRemoved: false}).then(data => console.log(data));
   * @example <caption>Get all clients belonging to a specific group</caption>
   * server.getClients({groupName: 'office'}).then(data => console.log(data));
   */
  async getClients({ groupName, includeRemoved = true } = {}) {
    const returnValue = [];
    const login = await this.#login();

    if (login === true) {
      const statusResponse = await this.#fetchJson('status');

      if (Array.isArray(statusResponse?.status)) {
        for (const client of statusResponse.status) {
          if (
            typeof groupName !== 'undefined' && groupName !== client.groupname
          ) {
            continue;
          }

          if (includeRemoved === false && client.delete_pending === '1') {
            continue;
          }

          returnValue.push({
            id: client.id,
            name: client.name,
            group: client.groupname,
            deletePending: client.delete_pending,
          });
        }

        return returnValue;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves a list of client discovery hints, also known as extra clients.
   *
   * @returns {Array} Array of objects representing client hints. Empty array when no matching client hints found.
   * @example <caption>Get extra clients</caption>
   * server.getClientHints().then(data => console.log(data));
   */
  async getClientHints() {
    const login = await this.#login();

    if (login === true) {
      const statusResponse = await this.#fetchJson('status');

      if (Array.isArray(statusResponse?.extra_clients)) {
        return statusResponse.extra_clients;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves client settings.
   * Matches all clients by default, but ```clientId``` or ```clientName``` can be used to request settings for one particular client.
   * Clients marked for removal are not excluded.
   *
   * @param {Object} [params] - (Optional) An object containing parameters.
   * @param {number} [params.clientId] - (Optional) Client's ID. Must be greater than zero. Takes precedence if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientName``` is also undefined.
   * @param {string} [params.clientName] - (Optional) Client's name, case sensitive. Ignored if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientId``` is also undefined.
   * @returns {Array} Array with objects represeting client settings. Empty array when no matching client found.
   * @example <caption>Get settings for all clients</caption>
   * server.getClientSettings().then(data => console.log(data));
   * @example <caption>Get settings for a specific client only</caption>
   * server.getClientSettings({clientName: 'laptop1'}).then(data => console.log(data));
   * server.getClientSettings({clientId: 3}).then(data => console.log(data));
   */
  async getClientSettings({ clientId, clientName } = {}) {
    if (clientId <= 0) {
      throw new Error('API call error: missing or invalid parameters');
    }

    const returnValue = [];

    if (clientName === '') {
      return returnValue;
    }

    const login = await this.#login();

    if (login === true) {
      const clientIds = [];
      const allClients = await this.getClients({ includeRemoved: true });

      if (allClients.some((client) => typeof client.id === 'undefined')) {
        throw new Error('API response error: missing values');
      }

      if (typeof clientId === 'undefined') {
        for (const client of allClients) {
          if (typeof clientName === 'undefined') {
            clientIds.push(client.id);
          } else {
            if (client.name === clientName) {
              clientIds.push(client.id);
              break;
            }
          }
        }
      } else {
        // need to make sure that given clientId really exists bacause 'clientsettings' API call returns settings even when called with invalid ID
        if (allClients.some((client) => client.id === clientId)) {
          clientIds.push(clientId);
        }
      }

      for (const id of clientIds) {
        const settingsResponse = await this.#fetchJson('settings', {
          sa: 'clientsettings',
          t_clientid: id,
        });

        if (typeof settingsResponse?.settings === 'object') {
          returnValue.push(settingsResponse.settings);
        } else {
          throw new Error('API response error: missing values');
        }
      }

      return returnValue;
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves authentication key for a specified client.
   * Using client ID should be preferred to client name for repeated method calls.
   *
   * @param {Object} params - (Required) An object containing parameters.
   * @param {number} params.clientId - (Required if clientName is undefined) Client's ID. Must be greater than 0. Takes precedence if both ```clientId``` and ```clientName``` are defined. Defaults to undefined.
   * @param {string} params.clientName - (Required if clientId is undefined) Client's name, case sensitive. Ignored if both ```clientId``` and ```clientName``` are defined. Defaults to undefined.
   * @returns {string} Client's authentication key. Empty string when no matching clients found.
   * @example <caption>Get authentication key for a specific client</caption>
   * server.getClientAuthkey({clientName: 'laptop1'}).then(data => console.log(data));
   * server.getClientAuthkey({clientId: 3}).then(data => console.log(data));
   */
  async getClientAuthkey({ clientId, clientName } = {}) {
    if (
      (typeof clientId === 'undefined' && typeof clientName === 'undefined') ||
      clientId <= 0
    ) {
      throw new Error('API call error: missing or invalid parameters');
    }

    let returnValue = '';

    if (clientName === '') {
      return returnValue;
    }

    const login = await this.#login();

    if (login === true) {
      const clientSettings = await this.getClientSettings(
        typeof clientId === 'undefined'
          ? { clientName: clientName }
          : { clientId: clientId },
      );

      if (Array.isArray(clientSettings)) {
        if (clientSettings.length > 0) {
          if (typeof clientSettings[0]?.internet_authkey === 'string') {
            returnValue = clientSettings[0].internet_authkey.toString();
          }
        }

        return returnValue;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves backup status.
   * Matches all clients by default, including clients marked for removal.
   * Client name or client ID can be passed as an argument in which case only that one client's status is returned.
   *
   * @param {Object} [params] - (Optional) An object containing parameters.
   * @param {number} [params.clientId] - (Optional) Client's ID. Must be greater than 0. Takes precedence if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientId``` is also undefined.
   * @param {string} [params.clientName] - (Optional) Client's name, case sensitive. Ignored if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientName``` is also undefined.
   * @param {boolean} [params.includeRemoved] - (Optional) Whether or not clients pending deletion should be included. Defaults to true.
   * @returns {Array} Array of objects with status info for matching clients. Empty array when no matching clients found.
   * @example <caption>Get status for all clients</caption>
   * server.getStatus().then(data => console.log(data));
   * @example <caption>Get status for all clients, but skip clients marked for removal</caption>
   * server.getStatus({includeRemoved: false}).then(data => console.log(data));
   * @example <caption>Get status for a specific client only</caption>
   * server.getStatus({clientName: 'laptop1'}).then(data => console.log(data));
   * server.getStatus({clientId: 3}).then(data => console.log(data));
   */
  async getStatus({ clientId, clientName, includeRemoved = true } = {}) {
    const defaultReturnValue = [];

    if (clientName === '') {
      return defaultReturnValue;
    }

    const login = await this.#login();

    if (login === true) {
      const statusResponse = await this.#fetchJson('status');

      if (Array.isArray(statusResponse?.status)) {
        if (
          typeof clientId === 'undefined' && typeof clientName === 'undefined'
        ) {
          if (includeRemoved === false) {
            return statusResponse.status.filter((client) =>
              client.delete_pending !== '1'
            );
          } else {
            return statusResponse.status;
          }
        } else {
          const clientStatus = statusResponse.status.find((client) =>
            typeof clientId !== 'undefined'
              ? client.id === clientId
              : client.name === clientName
          );

          if (typeof clientStatus !== 'undefined') {
            return (includeRemoved === false &&
                clientStatus.delete_pending === '1')
              ? defaultReturnValue
              : [clientStatus];
          } else {
            return defaultReturnValue;
          }
        }
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves storage usage.
   * Matches all clients by default, but ```clientName``` OR ```clientId``` can be used to request usage for one particular client.
   * Using client ID should be preferred to client name for repeated method calls.
   *
   * @param {Object} [params] - (Optional) An object containing parameters.
   * @param {number} [params.clientId] - (Optional) Client's ID. Must be greater than 0. Takes precedence if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientId``` is also undefined.
   * @param {string} [params.clientName] - (Optional) Client's name, case sensitive. Ignored if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientName``` is also undefined.
   * @returns {Array} Array of objects with storage usage info for each client. Empty array when no matching clients found.
   * @example <caption>Get usage for all clients</caption>
   * server.getUsage().then(data => console.log(data));
   * @example <caption>Get usage for a specific client only</caption>
   * server.getUsage({clientName: 'laptop1'}).then(data => console.log(data));
   * server.getUsage({clientId: 3}).then(data => console.log(data));
   */
  async getUsage({ clientId, clientName } = {}) {
    const defaultReturnValue = [];

    if (clientName === '') {
      return defaultReturnValue;
    }

    const login = await this.#login();

    if (login === true) {
      const usageResponse = await this.#fetchJson('usage');

      if (Array.isArray(usageResponse?.usage)) {
        if (
          typeof clientId === 'undefined' && typeof clientName === 'undefined'
        ) {
          return usageResponse.usage;
        } else {
          let mappedClientName;
          if (typeof clientId !== 'undefined') {
            // usage response does not contain a property with client ID so translation to client name is needed
            mappedClientName = await this.#getClientName(clientId);
          }
          return usageResponse.usage.find((client) =>
            typeof clientId !== 'undefined'
              ? client.name === mappedClientName
              : client.name === clientName
          ) ?? defaultReturnValue;
        }
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves a list of current and/or past activities.
   * Matches all clients by default, but ```clientName``` or ```clientId``` can be used to request activities for one particular client.
   * By default this method returns only activities that are currently in progress and skips last activities.
   *
   * @param {Object} [params] - (Optional) An object containing parameters.
   * @param {number} [params.clientId] - (Optional) Client's ID. Takes precedence if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientId``` is also undefined.
   * @param {string} [params.clientName] - (Optional) Client's name, case sensitive. Ignored if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which matches all clients if ```clientName``` is also undefined.
   * @param {boolean} [params.includeCurrent] - (Optional) Whether or not currently running activities should be included. Defaults to true.
   * @param {boolean} [params.includePast] - (Optional) Whether or not past activities should be included. Defaults to false.
   * @returns {Object} Object with activities info in two separate arrays (one for current and one for past activities). Object with empty arrays when no matching clients/activities found.
   * @example <caption>Get current (in progress) activities for all clients</caption>
   * server.getActivities().then(data => console.log(data));
   * @example <caption>Get past activities for all clients</caption>
   * server.getActivities({includeCurrent: false, includePast: true}).then(data => console.log(data));
   * @example <caption>Get current (in progress) activities for a specific client only</caption>
   * server.getActivities({clientName: 'laptop1'}).then(data => console.log(data));
   * server.getActivities({clientId: 3}).then(data => console.log(data));
   * @example <caption>Get all activities for a specific client only</caption>
   * server.getActivities({clientName: 'laptop1', includeCurrent: true, includePast: true}).then(data => console.log(data));
   * server.getActivities({clientId: '3', includeCurrent: true, includePast: true}).then(data => console.log(data));
   */
  async getActivities(
    { clientId, clientName, includeCurrent = true, includePast = false } = {},
  ) {
    const returnValue = { current: [], past: [] };

    if (clientName === '') {
      return returnValue;
    }

    if (includeCurrent === false && includePast === false) {
      return returnValue;
    }

    const login = await this.#login();

    if (login === true) {
      const activitiesResponse = await this.#fetchJson('progress');

      if (
        Array.isArray(activitiesResponse?.progress) &&
        Array.isArray(activitiesResponse?.lastacts)
      ) {
        if (includeCurrent === true) {
          if (
            typeof clientId === 'undefined' && typeof clientName === 'undefined'
          ) {
            returnValue.current = activitiesResponse.progress;
          } else {
            returnValue.current = activitiesResponse.progress.filter(
              (activity) =>
                typeof clientId !== 'undefined'
                  ? activity.clientid === clientId
                  : activity.name === clientName,
            );
          }
        }

        if (includePast === true) {
          if (
            typeof clientId === 'undefined' && typeof clientName === 'undefined'
          ) {
            returnValue.past = activitiesResponse.lastacts;
          } else {
            returnValue.past = activitiesResponse.lastacts.filter((activity) =>
              typeof clientId !== 'undefined'
                ? activity.clientid === clientId
                : activity.name === clientName
            );
          }
        }

        return returnValue;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves a list of file and/or image backups for a specific client.
   * Using client ID should be preferred to client name for repeated method calls.
   *
   * @param {Object} params - (Required) An object containing parameters.
   * @param {number} params.clientId - (Required if clientName is undefined) Client's ID. Must be greater than 0. Takes precedence if both ```clientId``` and ```clientName``` are defined. Defaults to undefined.
   * @param {string} params.clientName - (Required if clientId is undefined) Client's name, case sensitive. Ignored if both ```clientId``` and ```clientName``` are defined. Defaults to undefined.
   * @param {boolean} [params.includeFileBackups] - (Optional) Whether or not file backups should be included. Defaults to true.
   * @param {boolean} [params.includeImageBackups] - (Optional) Whether or not image backups should be included. Defaults to true.
   * @returns {Object} Object with backups info. Object with empty arrays when no matching clients/backups found.
   * @example <caption>Get all backups for a specific client</caption>
   * server.getBackups({clientName: 'laptop1'}).then(data => console.log(data));
   * server.getBackups({clientId: 3}).then(data => console.log(data));
   * @example <caption>Get image backups for a specific client</caption>
   * server.getBackups({clientName: 'laptop1', includeFileBackups: false}).then(data => console.log(data));
   * @example <caption>Get file backups for a specific client</caption>
   * server.getBackups({clientName: 'laptop1', includeImageBackups: false}).then(data => console.log(data));
   */
  async getBackups(
    {
      clientId,
      clientName,
      includeFileBackups = true,
      includeImageBackups = true,
    } = {},
  ) {
    if (
      (typeof clientId === 'undefined' && typeof clientName === 'undefined') ||
      clientId <= 0 ||
      (includeFileBackups === false && includeImageBackups === false)
    ) {
      throw new Error('API call error: missing or invalid parameters');
    }

    const returnValue = { file: [], image: [] };

    if (clientName === '') {
      return returnValue;
    }

    const login = await this.#login();

    if (login === true) {
      let mappedClientId;

      if (
        typeof clientId === 'undefined' && typeof clientName !== 'undefined'
      ) {
        mappedClientId = await this.#getClientId(clientName);
      }

      if (
        (typeof clientId !== 'undefined' && clientId > 0) ||
        (typeof mappedClientId !== 'undefined' && mappedClientId > 0)
      ) {
        const backupsResponse = await this.#fetchJson('backups', {
          sa: 'backups',
          clientid: clientId ?? mappedClientId,
        });

        if (
          Array.isArray(backupsResponse?.backup_images) &&
          Array.isArray(backupsResponse?.backups)
        ) {
          if (includeFileBackups === true) {
            returnValue.file = backupsResponse.backups;
          }

          if (includeImageBackups === true) {
            returnValue.image = backupsResponse.backup_images;
          }

          return returnValue;
        } else {
          throw new Error('API response error: missing values');
        }
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves live logs.
   * Server logs are requested by default, but ```clientName``` or ```clientId``` can be used to request logs for one particular client.
   * Instance property is being used internally to keep track of log entries that were previously requested.
   * When ```recentOnly``` is set to true, then only recent (unfetched) logs are requested.
   * Using client ID should be preferred to client name for repeated method calls.
   *
   * @param {Object} [params] - (Optional) An object containing parameters.
   * @param {number} [params.clientId] - (Optional) Client's ID. Takes precedence if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which means server logs will be requested if ```clientId``` is also undefined.
   * @param {string} [params.clientName] - (Optional) Client's name, case sensitive. Ignored if both ```clientId``` and ```clientName``` are defined. Defaults to undefined, which means server logs will be requested if ```clientName``` is also undefined.
   * @param {boolean} [params.recentOnly] - (Optional) Whether or not only recent (unfetched) entries should be requested. Defaults to false.
   * @returns {Array} Array of objects representing log entries. Empty array when no matching clients or logs found.
   * @example <caption>Get server logs</caption>
   * server.getLiveLog().then(data => console.log(data));
   * @example <caption>Get logs for a specific client only</caption>
   * server.getLiveLog({clientName: 'laptop1'}).then(data => console.log(data));
   * server.getLiveLog({clientId: 3}).then(data => console.log(data));
   * @example <caption>Get logs for a specific client only, but skip previously fetched logs</caption>
   * server.getLiveLog({clientName: 'laptop1', recentOnly: true}).then(data => console.log(data));
   */
  async getLiveLog({ clientId, clientName, recentOnly = false } = {}) {
    let returnValue = [];

    if (clientName === '') {
      return returnValue;
    }

    const login = await this.#login();

    if (login === true) {
      let mappedClientId;

      if (
        typeof clientId === 'undefined' && typeof clientName !== 'undefined'
      ) {
        mappedClientId = await this.#getClientId(clientName);
      }

      if (clientId === 0 || mappedClientId === 0) {
        // fail early to distinguish this case bacause 0 (zero) is a valid parameter value for 'livelog' call which should be used when both clientId and clientName are undefined
        return returnValue;
      }

      // TODO: Use semaphore to prevent race condition with this.#lastLogId
      const logResponse = await this.#fetchJson('livelog', {
        clientid: clientId ?? mappedClientId ?? 0,
        lastid: recentOnly === false ? 0 : this.#lastLogId.get(clientId),
      });

      if (Array.isArray(logResponse.logdata)) {
        const lastId = logResponse.logdata.slice(-1)[0]?.id;
        if (typeof lastId !== 'undefined') {
          this.#lastLogId.set(clientId, lastId);
        }

        returnValue = logResponse.logdata;
      } else {
        throw new Error('API response error: missing values');
      }

      return returnValue;
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }

  /**
   * Retrieves general settings.
   *
   * @returns {Object} Object with general settings.
   * @example <caption>Get general settings</caption>
   * server.getGeneralSettings().then(data => console.log(data));
   */
  async getGeneralSettings() {
    const login = await this.#login();

    if (login === true) {
      const settingsResponse = await this.#fetchJson('settings', {
        sa: 'general',
      });

      if (typeof settingsResponse?.settings === 'object') {
        return settingsResponse.settings;
      } else {
        throw new Error('API response error: missing values');
      }
    } else {
      throw new Error('Login failed: unknown reason');
    }
  }
}
