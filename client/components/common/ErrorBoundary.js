import React from "react";
import { Alert, Box, Button } from "@mui/material";
import i18n from "../../i18n/index.js";
import { stateFromError, stateFromProps } from "./error-boundary-state.js";

// Satu komponen yang gagal render tidak boleh mengosongkan seluruh halaman.
// Boundary ini dipasang per rute dan di-reset lewat prop `resetKey` saat
// pengguna berpindah halaman.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return stateFromError(error);
  }

  static getDerivedStateFromProps(props, state) {
    return stateFromProps(props, state);
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("ui_render_failed", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" onClick={() => window.location.reload()}>{i18n.t("common:actions.reload")}</Button>}
        >
          <strong>{i18n.t("common:states.crashTitle")}</strong> {i18n.t("common:states.crashMessage")}
        </Alert>
      </Box>
    );
  }
}

export default ErrorBoundary;
