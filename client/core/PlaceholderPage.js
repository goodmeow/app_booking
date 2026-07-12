import React from "react";
import { Container, Paper, Typography } from "@mui/material";

const PlaceholderPage = ({ title, description }) => (
  <Container maxWidth="lg" sx={{ py: 4 }}>
    <Paper sx={{ p: 4 }}>
      <Typography variant="h4" color="secondary" gutterBottom>{title}</Typography>
      <Typography color="text.secondary">{description}</Typography>
    </Paper>
  </Container>
);

export default PlaceholderPage;
