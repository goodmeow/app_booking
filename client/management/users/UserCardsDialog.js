import React from "react";
import { Alert, Button, Chip, Stack, TextField, Typography } from "@mui/material";
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
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {t("users.cardsActiveCount", { count: activeCount, max: CARD_ACTIVE_LIMIT })}
      </Typography>
      {formError ? <Alert severity="error">{formError}</Alert> : null}
      {cards.length === 0 ? (
        <Typography color="text.secondary">{t("users.cardNoCards")}</Typography>
      ) : (
        <Stack spacing={1}>
          {cards.map((card) => (
            <Stack
              key={card.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: "background.default" }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">{card.card_number}</Typography>
                <Chip
                  size="small"
                  label={t(card.status === "active" ? "users.cardActive" : "users.cardLost")}
                  color={card.status === "active" ? "success" : "default"}
                />
              </Stack>
              {card.status === "active" ? (
                <Button
                  size="small"
                  color="warning"
                  disabled={isMarkingLost || isReactivating}
                  aria-label={t("users.cardMarkLostAria", { number: card.card_number })}
                  onClick={() => onMarkLost(card)}
                >
                  {t("users.cardMarkLost")}
                </Button>
              ) : (
                <Button
                  size="small"
                  color="success"
                  disabled={isReactivating || isMarkingLost || limitReached}
                  aria-label={t("users.cardReactivateAria", { number: card.card_number })}
                  onClick={() => onReactivate(card)}
                >
                  {t("users.cardReactivate")}
                </Button>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      <TextField
        fullWidth
        label={t("users.cardNumber")}
        placeholder={t("users.cardAddPlaceholder")}
        helperText={limitReached ? t("users.cardLimit") : undefined}
        disabled={limitReached}
        value={cardNumber}
        onChange={(event) => setCardNumber(event.target.value)}
      />
    </Stack>
  </FormDialog>
);

export default UserCardsDialog;
