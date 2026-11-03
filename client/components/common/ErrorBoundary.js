import React from "react";
import { Alert, Button } from "antd";
import i18n from "../../i18n/index.js";
import { stateFromError, stateFromProps } from "./error-boundary-state.js";

// A component that fails to render must not blank the whole page.
// This boundary is mounted per route and is reset through the `resetKey` prop
// when the user navigates to another page.
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
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message={(
            <>
              <strong>{i18n.t("common:states.crashTitle")}</strong>{" "}
              {i18n.t("common:states.crashMessage")}
            </>
          )}
          action={(
            <Button size="small" onClick={() => window.location.reload()}>
              {i18n.t("common:actions.reload")}
            </Button>
          )}
        />
      </div>
    );
  }
}

export default ErrorBoundary;
