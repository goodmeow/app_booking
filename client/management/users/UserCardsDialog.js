import React from "react";
import { Alert, Button, Input, List, Space, Tag, Typography } from "antd";
import FormDialog from "../../components/common/FormDialog.js";
import { CARD_ACTIVE_LIMIT } from "./user-cards.js";

const UserCardsDialog = ({
  open,
  userName,
  cards,
  activeCount,
  limitReached,
  cardNumber,
  setCardNumber,
  formError,
  isAdding,
  isMarkingLost,
  isReactivating,
  onClose,
  onAddCard,
  onMarkLost,
  onReactivate,
  t,
}) => (
  <FormDialog
    open={open}
    title={t("users.cardsTitle", { name: userName })}
    formId="user-cards-form"
    loading={isAdding}
    submitDisabled={limitReached || !String(cardNumber).trim()}
    submitLabel={t("users.cardAdd")}
    maxWidth="xs"
    onClose={onClose}
    onSubmit={onAddCard}
  >
    <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 8 }}>
      <Typography.Text type="secondary">
        {t("users.cardsActiveCount", { count: activeCount, max: CARD_ACTIVE_LIMIT })}
      </Typography.Text>
      {formError ? <Alert type="error" showIcon message={formError} /> : null}

      <List
        size="small"
        bordered
        dataSource={cards}
        locale={{ emptyText: t("users.cardNoCards") }}
        renderItem={(card) => (
          <List.Item
            actions={[
              card.status === "active" ? (
                <Button
                  key="lost"
                  size="small"
                  disabled={isMarkingLost || isReactivating}
                  aria-label={t("users.cardMarkLostAria", { number: card.card_number })}
                  onClick={() => onMarkLost(card)}
                >
                  {t("users.cardMarkLost")}
                </Button>
              ) : (
                <Button
                  key="active"
                  size="small"
                  type="primary"
                  disabled={isReactivating || isMarkingLost || limitReached}
                  aria-label={t("users.cardReactivateAria", { number: card.card_number })}
                  onClick={() => onReactivate(card)}
                >
                  {t("users.cardReactivate")}
                </Button>
              ),
            ]}
          >
            <Space size={8}>
              <Typography.Text>{card.card_number}</Typography.Text>
              <Tag color={card.status === "active" ? "green" : undefined}>
                {t(card.status === "active" ? "users.cardActive" : "users.cardLost")}
              </Tag>
            </Space>
          </List.Item>
        )}
      />

      <div>
        <Input
          placeholder={t("users.cardAddPlaceholder")}
          disabled={limitReached}
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
        />
        {limitReached ? (
          <Typography.Text type="secondary">{t("users.cardLimit")}</Typography.Text>
        ) : null}
      </div>
    </Space>
  </FormDialog>
);

export default UserCardsDialog;
