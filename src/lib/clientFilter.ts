/**
 * Builds a client ID filter array based on the user's role and optional UI selection.
 *
 * - Super admins with no selection: `null` (no filter — see all data)
 * - Super admins with a selection: `string[]` with that single client ID
 * - Admins: the user's assigned client IDs
 * - Regular users: `[clientId]` or `[]` if no client is linked
 *
 * @param params.isSuperAdmin - Whether the current user is a super admin
 * @param params.isAdmin - Whether the current user is an admin
 * @param params.assignedClients - Client IDs assigned to the current user (admins)
 * @param params.clientId - The current user's own client ID (regular users)
 * @param params.selectedClientFilter - Optional UI-selected client filter value ("all" means no filter)
 * @returns An array of client IDs to filter by, or `null` to skip filtering entirely
 */
export function buildClientFilter(params: {
    isSuperAdmin: boolean;
    isAdmin: boolean;
    assignedClients: string[];
    clientId: string | undefined;
    selectedClientFilter?: string;
}): string[] | null {
    const { isSuperAdmin, isAdmin, assignedClients, clientId, selectedClientFilter } = params;

    if (isSuperAdmin) {
        if (selectedClientFilter && selectedClientFilter !== 'all') {
            return [selectedClientFilter];
        }
        return null;
    }

    if (isAdmin) {
        return assignedClients;
    }

    return clientId ? [clientId] : [];
}
