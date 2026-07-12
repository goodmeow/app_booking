import React, { useState } from "react";
import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { signup } from "./auth-helper.js";

const Signup = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.email.includes("@room.com")) {
      setError("Room cannot sign up here");
      return;
    }
    try {
      await signup(form);
      setMessage("New account successfully created.");
    } catch (reason) {
      setError(reason.message);
    }
  };

  const field = (name) => ({
    value: form[name],
    onChange: (event) => setForm({ ...form, [name]: event.target.value }),
  });

  return (
    <Box sx={{ minHeight: "calc(100vh - 64px)", display: "grid", placeItems: "center", p: 2 }}>
      <Paper component="form" onSubmit={submit} sx={{ width: "100%", maxWidth: 420, p: 4 }}>
        <Typography variant="h4" color="primary" gutterBottom>360Books</Typography>
        <Typography variant="h6" gutterBottom>Sign Up</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        <TextField fullWidth required label="Name" margin="normal" {...field("name")} />
        <TextField fullWidth required label="Email" type="email" margin="normal" {...field("email")} />
        <TextField fullWidth required label="Password" type="password" margin="normal" {...field("password")} />
        <Button fullWidth type="submit" variant="contained" sx={{ mt: 2 }}>Submit</Button>
        <Button component={Link} to="/signin" fullWidth sx={{ mt: 1 }}>Sign In</Button>
      </Paper>
    </Box>
  );
};

export default Signup;
