import React from "react";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { Link, useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isAuthenticated, signout } from "../auth/auth-helper.js";
import LanguageSwitcher from "../components/common/LanguageSwitcher.js";
import { useDetailUserQuery } from "../redux/services/users.js";

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
  const session = isAuthenticated();
  const admin = session?.user?.role === "ADMIN";
  const { data: currentUser } = useDetailUserQuery(session?.user?._id, { skip: !session?.user?._id });

  return (
    <AppBar position="static" color="inherit" elevation={1} sx={{ bgcolor: "common.white", color: "#003049" }}>
      <Container maxWidth={false}>
        <Toolbar disableGutters sx={{ overflowX: "auto" }}>
          <Box component={Link} to="/" color="inherit" sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none" }}>
            <Box component="img" src="/icon.svg" alt="" sx={{ width: 32, height: 32 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>{t("brand.name")}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", lg: "block" } }}>{t("brand.descriptor")}</Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, ml: 3 }}>
            {admin && <MenuLink to="/app-management">{t("nav.management")}</MenuLink>}
            {admin && <MenuLink to="/report">{t("nav.report")}</MenuLink>}
          </Box>
          {!session && <MenuLink to="/signup">{t("nav.signUp")}</MenuLink>}
          {!session && <MenuLink to="/signin">{t("nav.signIn")}</MenuLink>}
          {session && <MenuLink to={`/user/${session.user._id}`}>{t("nav.myProfile")}</MenuLink>}
          {session && <Typography variant="body2" sx={{ mx: 2 }}>{t("nav.welcome", { name: currentUser?.name || session.user.name })}</Typography>}
          {session && <Button color="inherit" onClick={() => signout(() => history.push("/"))}>{t("nav.signOut")}</Button>}
          <Box sx={{ ml: 1 }}><LanguageSwitcher /></Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Menu;
