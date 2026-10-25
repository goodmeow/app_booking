import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { wsConnect, wsDisconnect } from "../redux/websocket.js";

const ProtectedShell = ({ children }) => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(wsConnect());
    return () => dispatch(wsDisconnect());
  }, [dispatch]);

  return children;
};

export default ProtectedShell;
