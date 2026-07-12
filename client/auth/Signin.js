import React, { useState } from "react";
import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { Link, useHistory, useLocation } from "react-router-dom";
import { authenticate, signin } from "./auth-helper.js";

const Signin = () => {
  const history = useHistory();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (email.includes("@room.com")) {
      setError("Room cannot sign in here");
      return;
    }
    setLoading(true);
    try {
      const data = await signin({ email, password });
      authenticate(data, () => {
        const destination = location.state?.from || "/";
        history.replace(typeof destination === "string" ? destination : {
          pathname: destination.pathname || "/",
          search: destination.search || "",
          hash: destination.hash || "",
        });
      });
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", p: 2 }}>
      <Paper component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 420, p: 4 }}>
        <Typography variant="h4" color="primary" gutterBottom>360Books</Typography>
        <Typography variant="h6" gutterBottom>Sign In</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField fullWidth required label="Email" type="email" margin="normal" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField fullWidth required label="Password" type="password" margin="normal" value={password} onChange={(event) => setPassword(event.target.value)} />
        <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 2 }}>{loading ? "Loading..." : "Submit"}</Button>
        <Button component={Link} to="/signup" fullWidth sx={{ mt: 1 }}>Create account</Button>
      </Paper>
    </Box>
  );
};

export default Signin;
