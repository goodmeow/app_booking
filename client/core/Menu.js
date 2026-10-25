import React from "react";
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import MenuIconModule from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material/styles";
import { Link, useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isAuthenticated, signout } from "../auth/auth-helper.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { useDetailUserQuery } from "../redux/services/users.js";
import { useGetBrandingQuery, useGetPublicSettingsQuery } from "../redux/services/settings.js";
import { brandAsset } from "./brand-assets.js";

const BrandLockup = () => {
  const { t } = useTranslation("common");
  const { data: branding } = useGetBrandingQuery();
  return (
    <Box
      component={Link}
      to="/"
      color="inherit"
      sx={{ display: "flex", alignItems: "center", gap: 1.5, textDecoration: "none" }}
    >
      <Box
        component="img"
        src={brandAsset(branding, "mark")}
        alt=""
        sx={{ height: 38, width: "auto", display: "block" }}
      />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {/* The official "The Prasada" wordmark as an image, so the typography matches
            the tablet exactly; Room Booking below it uses the accent colour. */}
        <Box
          component="img"
          src={brandAsset(branding, "wordmark")}
          alt="The Prasada"
          sx={{ height: 15, width: "auto", display: "block" }}
        />
        <Typography
          component="span"
          sx={{
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "primary.main",
          }}
        >
          {branding?.brand_name || t("brand.name")}
        </Typography>
      </Box>
    </Box>
  );
};

const MenuIcon = resolveMuiIcon(MenuIconModule);

const MenuLink = ({ to, children }) => {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Button
      component={Link}
      to={to}
      color="inherit"
      sx={{
        color: active ? "primary.contrastText" : "text.secondary",
        bgcolor: active ? "primary.main" : "transparent",
        "&:hover": {
          bgcolor: active ? "primary.dark" : "rgba(237,242,246,0.06)",
          color: active ? "primary.contrastText" : "text.primary",
        },
      }}
    >
      {children}
    </Button>
  );
};

const Menu = () => {
  const { t } = useTranslation("common");
  const history = useHistory();
  const location = useLocation();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const session = isAuthenticated();
  const admin = session?.user?.role === "ADMIN";
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
    ...(admin ? [{ to: "/app-management", label: t("nav.management") }, { to: "/report", label: t("nav.report") }] : []),
    ...(!session && signupEnabled ? [{ to: "/signup", label: t("nav.signUp") }] : []),
    ...(!session ? [{ to: "/signin", label: t("nav.signIn") }] : []),
    ...(session ? [{ to: `/user/${session.user._id}`, label: t("nav.myProfile") }] : []),
  ];

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ top: 0, zIndex: theme.zIndex.appBar }}>
      <Container maxWidth={false}>
        <Toolbar disableGutters>
        <BrandLockup />
          <Box sx={{ flexGrow: 1, ml: 3, display: { xs: "none", md: "block" } }}>
            {navItems.filter(({ to }) => to === "/app-management" || to === "/report").map(({ to, label }) => (
              <MenuLink key={to} to={to}>{label}</MenuLink>
            ))}
          </Box>
          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5 }}>
            {navItems.filter(({ to }) => to !== "/app-management" && to !== "/report").map(({ to, label }) => (
              <MenuLink key={to} to={to}>{label}</MenuLink>
            ))}
            {session && <Typography variant="body2" sx={{ mx: 2 }}>{t("nav.welcome", { name: displayName })}</Typography>}
            {session && <Button color="inherit" onClick={handleSignout}>{t("nav.signOut")}</Button>}
          </Box>
          {mobile ? (
            <IconButton
              edge="end"
              color="inherit"
              aria-label={t("nav.openMenu")}
              onClick={() => setDrawerOpen(true)}
              sx={{ ml: "auto" }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}
        </Toolbar>
      </Container>
      <Drawer anchor="right" open={drawerOpen} onClose={closeDrawer}>
        <Box sx={{ width: 280 }} role="presentation">
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">{branding?.brand_name || t("brand.name")}</Typography>
            {session ? <Typography variant="body2" color="text.secondary">{t("nav.welcome", { name: displayName })}</Typography> : null}
          </Box>
          <Divider />
          <List>
            <ListItemButton component={Link} to="/" selected={location.pathname === "/"} onClick={closeDrawer}>
              <ListItemText primary={t("nav.calendar")} />
            </ListItemButton>
            {navItems.map(({ to, label }) => (
              <ListItemButton key={to} component={Link} to={to} selected={location.pathname === to} onClick={closeDrawer}>
                <ListItemText primary={label} />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <Box sx={{ p: 2 }}>
            {session ? (
              <Button fullWidth onClick={handleSignOutClick}>{t("nav.signOut")}</Button>
            ) : null}
          </Box>
        </Box>
      </Drawer>
    </AppBar>
  );
};

export default Menu;
