import React from "react";
import { Button, Container, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const { t } = useTranslation("common");
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="h4" component="h1">{t("states.notFoundTitle")}</Typography>
          <Typography color="text.secondary">{t("states.notFoundMessage")}</Typography>
          <Button component={Link} to="/" variant="contained">{t("nav.calendar")}</Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default NotFound;
