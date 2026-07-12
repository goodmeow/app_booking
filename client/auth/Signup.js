import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { isRoomAccountEmail, signup } from "./auth-helper.js";

const Signup = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (isRoomAccountEmail(form.email)) {
      setError("Room cannot sign up here");
      return;
    }
    setLoading(true);
    try {
      await signup(form);
      setMessage("New account successfully created.");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  };

  const field = (name) => ({
    value: form[name],
    onChange: (event) => setForm({ ...form, [name]: event.target.value }),
  });

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", p: 2 }}>
      <Paper component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 420, p: 4, bgcolor: "common.white" }}>
        <Box component="img" src="/icon.svg" alt="360Books" sx={{ display: "block", width: 80, height: 80, mx: "auto", mb: 2 }} />
        <Typography variant="h4" color="primary" align="center" gutterBottom>360Books</Typography>
        <Typography variant="h6" gutterBottom>Sign Up</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField fullWidth required label="Name" margin="normal" {...field("name")} />
        <TextField fullWidth required label="Email" type="email" margin="normal" {...field("email")} />
        <TextField fullWidth required label="Password" type="password" margin="normal" {...field("password")} />
        <Button fullWidth type="submit" variant="contained" disabled={loading} sx={{ mt: 2 }}>{loading ? "Loading..." : "Submit"}</Button>
        <Button component={Link} to="/signin" fullWidth sx={{ mt: 1 }}>Sign In</Button>
      </Paper>
      <Dialog open={Boolean(message)} onClose={() => setMessage("")} aria-labelledby="signup-success-title">
        <DialogTitle id="signup-success-title">Account created</DialogTitle>
        <DialogContent>
          <DialogContentText>{message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button component={Link} to="/signin" variant="contained">Sign In</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Signup;
