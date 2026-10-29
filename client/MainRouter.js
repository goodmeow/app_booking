import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
import Signin from "./auth/Signin.js";
import ForcePasswordChange from "./auth/ForcePasswordChange.js";
import Signup from "./auth/Signup.js";
import { SetupGate, SetupRoute } from "./auth/SetupGate.js";
import { isAuthenticated } from "./auth/auth-helper.js";
import Menu from "./core/Menu.js";
import NotFound from "./core/NotFound.js";
import ProtectedShell from "./core/ProtectedShell.js";
import VersionFooter from "./core/VersionFooter.js";
import { LoadingState } from "./components/common/AsyncState.js";
import ErrorBoundary from "./components/common/ErrorBoundary.js";
import KioskApp from "./kiosk/KioskApp.js";
import { MANAGEMENT_MENUS, useMenuAccess } from "./auth/use-menu-access.js";
import { Alert } from "antd";

const AppManagement = React.lazy(() => import("./management/AppManagement.js"));
const UserProfile = React.lazy(() => import("./profile/UserProfile.js"));
const RoomUsageReport = React.lazy(() => import("./report/RoomUsageReport.js"));
const MeetingCalendar = React.lazy(() => import("./calendar/MeetingCalendar.js"));

const ProtectedRoute = ({ component: Component, anyOf, ...rest }) => {
  const access = useMenuAccess();
  return (
    <Route
      {...rest}
      render={(props) => {
        const session = isAuthenticated();
        if (!session) return <Redirect to={{ pathname: "/signin", state: { from: props.location } }} />;
        if (session.user.mustChangePassword) {
          return (
            <ProtectedShell>
              <ForcePasswordChange />
            </ProtectedShell>
          );
        }
        if (anyOf && access.isLoading) {
          return (
            <ProtectedShell>
              <LoadingState />
            </ProtectedShell>
          );
        }
        if (anyOf && !anyOf.some((menu) => access.can(menu))) return <Redirect to="/" />;
        return (
          <ProtectedShell>
            <ErrorBoundary resetKey={`${props.location.pathname}${props.location.search}`}>
              <React.Suspense fallback={<LoadingState />}>
                <Component {...props} />
              </React.Suspense>
            </ErrorBoundary>
          </ProtectedShell>
        );
      }}
    />
  );
};

// The home route follows the matrix: calendar first, then the first menu the
// role may open. A role with no menus gets a plain notice instead of a loop.
const HomeRoute = () => {
  const access = useMenuAccess();
  if (access.isLoading) return <LoadingState />;
  if (access.can("calendar")) return <MeetingCalendar />;
  if (access.can("report")) return <Redirect to="/report" />;
  if (access.canManage) return <Redirect to="/app-management" />;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ margin: 32 }}
      message="This account has no menu access. Ask a super admin to open Management > Settings > User Role Management."
    />
  );
};

const WebChrome = () => {
  const location = useLocation();
  const session = isAuthenticated();
  if (location.pathname === "/signin") return null;
  // The first-admin setup page is a standalone screen: no navigation chrome.
  if (location.pathname === "/setup") return null;
  // The forced password screen must not mount the header, because its user
  // query would be rejected until the password is changed.
  if (session?.user?.mustChangePassword) return null;
  return <Menu />;
};

const WebRouter = () => (
  <>
    <WebChrome />
    <SetupGate>
      <Switch>
        <Route path="/setup" component={SetupRoute} />
        <Route path="/signup" component={Signup} />
        <Route path="/signin" component={Signin} />
        <ProtectedRoute path="/app-management" anyOf={MANAGEMENT_MENUS} component={AppManagement} />
        <ProtectedRoute path="/report" anyOf={["report"]} component={RoomUsageReport} />
        <ProtectedRoute path="/user/:userId" component={UserProfile} />
        <ProtectedRoute exact path="/" component={HomeRoute} />
        <Route component={NotFound} />
      </Switch>
    </SetupGate>
    {/* The CMS version number is shown on every web page: Ver.Rev from package.json. */}
    <VersionFooter />
  </>
);

const MainRouter = () => (
  <Switch>
    <Route exact path="/kiosk/setup" render={() => (
      <React.Suspense fallback={<LoadingState />}>
        <KioskApp forceProvision />
      </React.Suspense>
    )} />
    <Route path="/kiosk" render={() => (
      <React.Suspense fallback={<LoadingState />}>
        <KioskApp />
      </React.Suspense>
    )} />
    <Route component={WebRouter} />
  </Switch>
);

export default MainRouter;
