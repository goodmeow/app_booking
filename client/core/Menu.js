import React from "react";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { Link, useHistory, useLocation } from "react-router-dom";
import { isAuthenticated, signout } from "../auth/auth-helper.js";

const MenuLink = ({ to, children }) => {
  const location = useLocation();
  return <Button component={Link} to={to} color="inherit" sx={{ opacity: location.pathname === to ? 1 : 0.8 }}>{children}</Button>;
};

const Menu = () => {
  const history = useHistory();
  const session = isAuthenticated();
  const admin = session?.user?.role?.toUpperCase() === "ADMIN";

  return (
    <AppBar position="static" color="primary">
      <Container maxWidth={false}>
        <Toolbar disableGutters>
          <Typography component={Link} to="/" variant="h6" color="inherit" sx={{ textDecoration: "none", fontWeight: 700 }}>360Books</Typography>
          <Box sx={{ flexGrow: 1, ml: 3 }}>
            {session && <MenuLink to="/">360Books</MenuLink>}
            {admin && <MenuLink to="/app-management">Apps Management</MenuLink>}
            {admin && <MenuLink to="/report">Report</MenuLink>}
          </Box>
          {!session && <MenuLink to="/signup">Sign up</MenuLink>}
          {!session && <MenuLink to="/signin">Sign In</MenuLink>}
          {session && <MenuLink to={`/user/${session.user._id}`}>My Profile</MenuLink>}
          {session && <Typography variant="body2" sx={{ mx: 2 }}>Welcome, {session.user.name}</Typography>}
          {session && <Button color="inherit" onClick={() => signout(() => history.push("/signin"))}>Sign out</Button>}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Menu;
