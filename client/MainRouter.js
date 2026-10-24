import React from "react";
import { Redirect, Route, Switch, useLocation } from "react-router-dom";
import Signin from "./auth/Signin.js";
import ForcePasswordChange from "./auth/ForcePasswordChange.js";
import Signup from "./auth/Signup.js";
import { isAuthenticated } from "./auth/auth-helper.js";
import Menu from "./core/Menu.js";
import NotFound from "./core/NotFound.js";
import ProtectedShell from "./core/ProtectedShell.js";
import VersionFooter from "./core/VersionFooter.js";
import { LoadingState } from "./components/common/AsyncState.js";
import ErrorBoundary from "./components/common/ErrorBoundary.js";
import KioskApp from "./kiosk/KioskApp.js";

const AppManagement = React.lazy(() => import("./management/AppManagement.js"));
const UserProfile = React.lazy(() => import("./profile/UserProfile.js"));
const RoomUsageReport = React.lazy(() => import("./report/RoomUsageReport.js"));
const MeetingCalendar = React.lazy(() => import("./calendar/MeetingCalendar.js"));

const ProtectedRoute = ({ component: Component, adminOnly = false, ...rest }) => (
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
      if (adminOnly && session.user.role !== "ADMIN") return <Redirect to="/" />;
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

const WebChrome = () => {
  const location = useLocation();
  const session = isAuthenticated();
  if (location.pathname === "/signin") return null;
  // The forced password screen must not mount the header, because its user
  // query would be rejected until the password is changed.
  if (session?.user?.mustChangePassword) return null;
  return <Menu />;
};

const WebRouter = () => (
  <>
    <WebChrome />
    <Switch>
      <Route path="/signup" component={Signup} />
      <Route path="/signin" component={Signin} />
      <ProtectedRoute path="/app-management" adminOnly component={AppManagement} />
      <ProtectedRoute path="/report" adminOnly component={RoomUsageReport} />
      <ProtectedRoute path="/user/:userId" component={UserProfile} />
      <ProtectedRoute exact path="/" component={MeetingCalendar} />
      <Route component={NotFound} />
    </Switch>
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
