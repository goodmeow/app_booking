import React from "react";
import { Redirect, Route, Switch } from "react-router-dom";
import Signin from "./auth/Signin.js";
import Signup from "./auth/Signup.js";
import { isAuthenticated } from "./auth/auth-helper.js";
import Menu from "./core/Menu.js";
import ProtectedShell from "./core/ProtectedShell.js";
import { LoadingState } from "./components/common/AsyncState.js";

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
      if (adminOnly && session.user.role !== "ADMIN") return <Redirect to="/" />;
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

const MainRouter = () => (
  <>
    <Menu />
    <Switch>
      <Route path="/signup" component={Signup} />
      <Route path="/signin" component={Signin} />
      <ProtectedRoute path="/app-management" adminOnly component={AppManagement} />
      <ProtectedRoute path="/report" adminOnly component={RoomUsageReport} />
      <ProtectedRoute path="/user/:userId" component={UserProfile} />
      <ProtectedRoute exact path="/" component={MeetingCalendar} />
    </Switch>
  </>
);

export default MainRouter;
