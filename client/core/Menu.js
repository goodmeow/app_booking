import React from "react";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { Link, useHistory, useLocation } from "react-router-dom";
import { isAuthenticated, signout } from "../auth/auth-helper.js";
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
            <Typography variant="h6" sx={{ fontWeight: 700 }}>360Books</Typography>
          </Box>
          <Box sx={{ flexGrow: 1, ml: 3 }}>
            {admin && <MenuLink to="/app-management">Apps Management</MenuLink>}
            {admin && <MenuLink to="/report">Report</MenuLink>}
          </Box>
          {!session && <MenuLink to="/signup">Sign up</MenuLink>}
          {!session && <MenuLink to="/signin">Sign In</MenuLink>}
          {session && <MenuLink to={`/user/${session.user._id}`}>My Profile</MenuLink>}
          {session && <Typography variant="body2" sx={{ mx: 2 }}>Welcome, {currentUser?.name || session.user.name}</Typography>}
          {session && <Button color="inherit" onClick={() => signout(() => history.push("/"))}>Sign out</Button>}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Menu;
