import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import Signin from "./auth/Signin.js";
import Signup from "./auth/Signup.js";
import { isAuthenticated } from "./auth/auth-helper.js";
import Menu from "./core/Menu.js";
import PlaceholderPage from "./core/PlaceholderPage.js";
import ProtectedShell from "./core/ProtectedShell.js";
import { LoadingState } from "./components/common/AsyncState.js";

const AppManagement = React.lazy(() => import("./management/AppManagement.js"));

const ProtectedRoute = ({ component: Component, adminOnly = false, ...rest }) => (
  <Route
    {...rest}
    render={(props) => {
      const session = isAuthenticated();
      if (!session) return <Redirect to={{ pathname: "/signin", state: { from: props.location } }} />;
      if (adminOnly && session.user.role.toUpperCase() !== "ADMIN") return <Redirect to="/" />;
      return (
        <ProtectedShell>
          <React.Suspense fallback={<LoadingState />}>
            <Component {...props} />
          </React.Suspense>
        </ProtectedShell>
      );
    }}
  />
);

const CalendarShell = () => <PlaceholderPage title="Meeting Calendar" description="Calendar and meeting workflow will be restored in Phase 7." />;
const ReportShell = () => <PlaceholderPage title="Room Usage Report" description="Usage history and XLSX export will be restored in Phase 7." />;
const ProfileShell = () => <PlaceholderPage title="My Profile" description="Profile and password workflows will be restored in Phase 7." />;

const MainRouter = () => (
  <>
    <Menu />
    <Switch>
      <Route path="/signup" component={Signup} />
      <Route path="/signin" component={Signin} />
      <ProtectedRoute path="/app-management" adminOnly component={AppManagement} />
      <ProtectedRoute path="/report" adminOnly component={ReportShell} />
      <ProtectedRoute path="/user/:userId" component={ProfileShell} />
      <ProtectedRoute exact path="/" component={CalendarShell} />
    </Switch>
  </>
);

export default MainRouter;
