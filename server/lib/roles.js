// The first account created by /setup is the super admin. It keeps every menu
// and may not be demoted, so an installation can always be recovered.
export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

export const normalizedRole = (role) => String(role ?? "").trim().toUpperCase();

export const isSuperAdminRole = (role) => normalizedRole(role) === SUPER_ADMIN_ROLE;

export const isReceptionistRole = (role) => normalizedRole(role) === "RECEPTIONIST";

// Every place that used to accept ADMIN also accepts SUPER_ADMIN.
export const isAdminRole = (role) => ["ADMIN", SUPER_ADMIN_ROLE].includes(normalizedRole(role));
