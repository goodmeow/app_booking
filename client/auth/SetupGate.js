import React from "react";
import { Redirect, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Alert, Button } from "antd";
import { useGetSetupStatusQuery } from "../redux/services/setup.js";
import { LoadingState } from "../components/common/AsyncState.js";
import InitialSetup from "./InitialSetup.js";

// Runs before every web route. While the installation still needs its first
// admin, any page is replaced by the setup page. A failing status endpoint must
// not lock the whole CMS, so the ordinary pages keep rendering behind a retry
// banner instead of showing a dead end.
export const SetupGate = ({ children }) => {
  const { t } = useTranslation(["auth", "common"]);
  const location = useLocation();
  const { data, isLoading, isError, isFetching, refetch } = useGetSetupStatusQuery();

  // The setup page owns its own status handling below; gating it here would
  // redirect it against itself and loop.
  if (location.pathname === "/setup") return children;

  if (isLoading) return <LoadingState />;

  if (isError) {
    return (
      <>
        <div style={{ padding: 16 }}>
          <Alert
            type="warning"
            showIcon
            message={t("auth:setup.statusError")}
            action={(
              <Button size="small" disabled={isFetching} onClick={() => refetch()}>
                {t("common:actions.retry")}
              </Button>
            )}
          />
        </div>
        {children}
      </>
    );
  }

  if (data?.required) {
    return <Redirect to={{ pathname: "/setup", state: { from: location } }} />;
  }

  return children;
};

// Route target for /setup. It redirects to sign in once setup is complete, and
// only mounts the form after the server confirms that setup is still required.
export const SetupRoute = () => {
  const { t } = useTranslation(["auth", "common"]);
  const { data, isLoading, isError, isFetching, refetch } = useGetSetupStatusQuery();

  if (isLoading) return <LoadingState />;

  if (isError) {
    return (
      <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message={t("auth:setup.statusError")}
          action={(
            <Button size="small" disabled={isFetching} onClick={() => refetch()}>
              {t("common:actions.retry")}
            </Button>
          )}
        />
      </div>
    );
  }

  if (data?.required === false) return <Redirect to="/signin" />;

  return <InitialSetup />;
};
