import React from "react";
import { Button, Drawer, Grid, Layout, Space, Typography } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Link, useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isAuthenticated, signout } from "../auth/auth-helper.js";
import { useDetailUserQuery } from "../redux/services/users.js";
import { useGetBrandingQuery, useGetPublicSettingsQuery } from "../redux/services/settings.js";
import { brandAsset } from "./brand-assets.js";
import { useMenuAccess } from "../auth/use-menu-access.js";

const { Header } = Layout;

const BrandLockup = () => {
  const { t } = useTranslation("common");
  const { data: branding } = useGetBrandingQuery();
  return (
    <Link
      to="/"
      style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}
    >
      <img
        src={brandAsset(branding, "mark")}
        alt=""
        style={{ height: 38, width: "auto", display: "block" }}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* The official "The Prasada" wordmark as an image, so the typography matches
            the tablet exactly; Room Booking below it uses the accent colour. */}
        <img
          src={brandAsset(branding, "wordmark")}
          alt="The Prasada"
          style={{ height: 15, width: "auto", display: "block" }}
        />
        <Typography.Text
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "#2FB46A",
          }}
        >
          {branding?.brand_name || t("brand.name")}
        </Typography.Text>
      </span>
    </Link>
  );
};

const MenuLink = ({ to, children }) => {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link to={to}>
      <Button type={active ? "primary" : "text"}>{children}</Button>
    </Link>
  );
};

const Menu = () => {
  const { t } = useTranslation("common");
  const history = useHistory();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const mobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const session = isAuthenticated();
  const { can, canManage } = useMenuAccess();
  const { data: currentUser } = useDetailUserQuery(session?.user?._id, { skip: !session?.user?._id });
  const { data: publicSettings } = useGetPublicSettingsQuery();
  const { data: branding } = useGetBrandingQuery();
  const signupEnabled = publicSettings?.self_signup_enabled === true;
  const displayName = currentUser?.name || session?.user?.name;
  const closeDrawer = () => setDrawerOpen(false);
  const handleSignOutClick = () => {
    closeDrawer();
    handleSignout();
  };
  const handleSignout = () => signout(() => history.push("/"));
  const navItems = [
    ...(canManage ? [{ to: "/app-management", label: t("nav.management") }] : []),
    ...(can("report") ? [{ to: "/report", label: t("nav.report") }] : []),
    ...(!session && signupEnabled ? [{ to: "/signup", label: t("nav.signUp") }] : []),
    ...(!session ? [{ to: "/signin", label: t("nav.signIn") }] : []),
    ...(session ? [{ to: `/user/${session.user._id}`, label: t("nav.myProfile") }] : []),
  ];
  const primaryItems = navItems.filter(({ to }) => to === "/app-management" || to === "/report");
  const secondaryItems = navItems.filter(({ to }) => to !== "/app-management" && to !== "/report");

  return (
    <>
      <Header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 24px",
          background: "#0C1014",
          borderBottom: "1px solid rgba(235,244,240,0.10)",
        }}
      >
        <BrandLockup />
        {!mobile ? (
          <>
            <Space size={4} style={{ flex: 1, marginLeft: 16 }}>
              {primaryItems.map(({ to, label }) => (
                <MenuLink key={to} to={to}>{label}</MenuLink>
              ))}
            </Space>
            <Space size={4}>
              {secondaryItems.map(({ to, label }) => (
                <MenuLink key={to} to={to}>{label}</MenuLink>
              ))}
              {session ? (
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                  {t("nav.welcome", { name: displayName })}
                </Typography.Text>
              ) : null}
              {session ? <Button type="text" onClick={handleSignout}>{t("nav.signOut")}</Button> : null}
            </Space>
          </>
        ) : (
          <Button
            type="text"
            icon={<MenuOutlined />}
            aria-label={t("nav.openMenu")}
            onClick={() => setDrawerOpen(true)}
            style={{ marginLeft: "auto" }}
          />
        )}
      </Header>

      <Drawer
        title={branding?.brand_name || t("brand.name")}
        placement="right"
        open={drawerOpen}
        onClose={closeDrawer}
        width={280}
      >
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          {session ? (
            <Typography.Text type="secondary">
              {t("nav.welcome", { name: displayName })}
            </Typography.Text>
          ) : null}
          {can("calendar") ? (
            <Link to="/" onClick={closeDrawer}>
              <Button block type={location.pathname === "/" ? "primary" : "text"}>
                {t("nav.calendar")}
              </Button>
            </Link>
          ) : null}
          {navItems.map(({ to, label }) => (
            <Link key={to} to={to} onClick={closeDrawer}>
              <Button block type={location.pathname === to ? "primary" : "text"}>
                {label}
              </Button>
            </Link>
          ))}
          {session ? (
            <Button block danger onClick={handleSignOutClick}>
              {t("nav.signOut")}
            </Button>
          ) : null}
        </Space>
      </Drawer>
    </>
  );
};

export default Menu;
