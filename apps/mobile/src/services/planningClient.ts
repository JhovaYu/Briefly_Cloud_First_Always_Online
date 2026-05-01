/**
 * Planning client — mobile wrapper around @tuxnotas/shared PlanningApiClient.
 *
 * Token is retrieved synchronously from AuthContext session.
 * Wraps shared client and adds no additional network logic.
 */

import { PlanningApiClient } from '@tuxnotas/shared/src/logic/PlanningApiClient';

const BASE_URL =
    (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://briefly.ddns.net') + '/api/planning';

let _client: PlanningApiClient | null = null;
let _syncGetter: (() => string | null) | null = null;

/**
 * Returns a singleton PlanningApiClient.
 * getAccessToken is synchronous (AuthContext session access).
 * The shared client expects async, so we wrap with async.
 */
function getClient(getAccessToken: () => string | null): PlanningApiClient {
    if (!_client || _syncGetter !== getAccessToken) {
        _client = new PlanningApiClient({
            baseUrl: BASE_URL,
            getAccessToken: async () => getAccessToken(),
        });
        _syncGetter = getAccessToken;
    }
    return _client;
}

export function createPlanningClient(getAccessToken: () => string | null): PlanningApiClient {
    return getClient(getAccessToken);
}

export { BASE_URL as PLANNING_API_BASE_URL };