import { useGetMyMenusQuery } from "../redux/services/access.js";
import { isAuthenticated } from "./auth-helper.js";
import { isSuperAdminRole } from "../domain/roles.js";

export const MANAGEMENT_MENUS = ["users", "rooms", "devices", "face", "settings"];

// Central menu gate for the CMS shell. The server is the source of truth; this
// hook only hides routes and tabs so a disabled menu is not offered.
export const useMenuAccess = () => {
  const session = isAuthenticated();
  const { data, isLoading, isError } = useGetMyMenusQuery(undefined, {
    skip: !session,
    pollingInterval: 60000,
  });
  const isSuperAdmin = data?.super_admin === true || isSuperAdminRole(session?.user?.role);
  // Once the server answered, use its list for everyone: it already dropped
  // menus whose backing service is unreachable, including for super_admin.
  const menus = data?.menus || (isSuperAdmin ? [...MANAGEMENT_MENUS, "calendar", "report"] : []);
  const can = (menuKey) => menus.includes(menuKey);
  return {
    menus,
    can,
    isLoading: Boolean(session) && isLoading,
    isError,
    isSuperAdmin,
    canManage: MANAGEMENT_MENUS.some(can),
  };
};
