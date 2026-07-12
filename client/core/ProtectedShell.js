import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { isAuthenticated } from "../auth/auth-helper.js";
import { wsConnect, wsDisconnect, wsJoinRoom } from "../redux/websocket.js";

const ProtectedShell = ({ children }) => {
  const dispatch = useDispatch();
  const session = isAuthenticated();

  useEffect(() => {
    dispatch(wsConnect());
    if (session?.user?.email) dispatch(wsJoinRoom(session.user.email));
    return () => dispatch(wsDisconnect());
  }, [dispatch, session?.user?.email]);

  return children;
};

export default ProtectedShell;
