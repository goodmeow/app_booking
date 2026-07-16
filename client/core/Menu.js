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
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { resolveMuiIcon } from "../components/common/resolve-mui-icon.js";
import { useDetailUserQuery } from "../redux/services/users.js";

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
        color: active ? "common.white" : "#003049",
        bgcolor: active ? "primary.main" : "transparent",
        "&:hover": { bgcolor: active ? "primary.dark" : "action.hover" },
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
  const displayName = currentUser?.name || session?.user?.name;
  const closeDrawer = () => setDrawerOpen(false);
  const handleSignout = () => signout(() => history.push("/"));
  const navItems = [
    ...(admin ? [{ to: "/app-management", label: t("nav.management") }, { to: "/report", label: t("nav.report") }] : []),
    ...(!session ? [{ to: "/signup", label: t("nav.signUp") }, { to: "/signin", label: t("nav.signIn") }] : []),
    ...(session ? [{ to: `/user/${session.user._id}`, label: t("nav.myProfile") }] : []),
  ];

  return (
    <AppBar position="static" color="inherit" elevation={1} sx={{ bgcolor: "common.white", color: "#003049" }}>
      <Container maxWidth={false}>
        <Toolbar disableGutters>
          <Box component={Link} to="/" color="inherit" sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none" }}>
            <Box component="img" src="/icon.svg" alt="" sx={{ width: 32, height: 32 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>{t("brand.name")}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", lg: "block" } }}>{t("brand.descriptor")}</Typography>
            </Box>
          </Box>
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
            <Box sx={{ ml: 1 }}><LanguageSwitcher /></Box>
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
            <Typography variant="h6">{t("brand.name")}</Typography>
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
            <LanguageSwitcher />
            {session ? (
              <Button fullWidth sx={{ mt: 2 }} onClick={() => { closeDrawer(); handleSignout(); }}>{t("nav.signOut")}</Button>
            ) : null}
          </Box>
        </Box>
      </Drawer>
    </AppBar>
  );
};

export default Menu;
