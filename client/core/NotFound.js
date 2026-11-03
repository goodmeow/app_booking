import React from "react";
import { Button, Result } from "antd";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const { t } = useTranslation("common");
  return (
    <Result
      status="404"
      title={t("states.notFoundTitle")}
      subTitle={t("states.notFoundMessage")}
      extra={(
        <Link to="/">
          <Button type="primary">{t("nav.calendar")}</Button>
        </Link>
      )}
    />
  );
};

export default NotFound;
