import React, { useEffect } from "react";
import { App } from "antd";

const FeedbackSnackbar = ({ open, message, severity = "error", onClose }) => {
  const { message: messageApi } = App.useApp();

  useEffect(() => {
    if (!open || !message) return;
    messageApi.open({ type: severity, content: message });
    onClose?.();
  }, [message, messageApi, onClose, open, severity]);

  return null;
};

export default FeedbackSnackbar;
