import { useState } from "react";
import { userCards, activeCardCount, cardLimitReached } from "./user-cards.js";
import { userMutationError } from "./user-api-errors.js";
import {
  useAddUserCardMutation,
  useMarkUserCardLostMutation,
} from "../../redux/services/users.js";

// Owns the card dialog: the cards of the selected user, the new card number, and
// the two mutations. Cards come from the users list row and are patched locally
// with the mutation responses, so the dialog stays correct while the list tag is
// being refetched in the background.
export const useUserCardsDialog = ({ t }) => {
  const [targetUser, setTargetUser] = useState(null);
  const [cards, setCards] = useState([]);
  const [cardNumber, setCardNumber] = useState("");
  const [formError, setFormError] = useState("");

  const [addUserCard, { isLoading: isAdding, reset: resetAdd }] = useAddUserCardMutation();
  const [markUserCardLost, { isLoading: isMarkingLost, reset: resetLost }] = useMarkUserCardLostMutation();

  const activeCount = activeCardCount({ cards });
  const limitReached = cardLimitReached({ cards });

  const openCards = (user) => {
    resetAdd();
    resetLost();
    setTargetUser(user);
    setCards(userCards(user));
    setCardNumber("");
    setFormError("");
  };

  const close = () => {
    if (isAdding) return;
    setTargetUser(null);
    setCards([]);
    setCardNumber("");
    setFormError("");
    resetAdd();
    resetLost();
  };

  const submitCard = async (event) => {
    event.preventDefault();
    if (!targetUser || isAdding || limitReached) return;
    const number = cardNumber.trim();
    if (!number) return;

    setFormError("");
    try {
      const created = await addUserCard({ userId: targetUser._id, card_number: number }).unwrap();
      setCards((current) => [...current, created]);
      setCardNumber("");
      resetAdd();
    } catch (mutationError) {
      setFormError(userMutationError(mutationError, t, t("users.cardAddError")));
    }
  };

  const markLost = async (card) => {
    if (!targetUser || isMarkingLost || card.status !== "active") return;

    setFormError("");
    try {
      const updated = await markUserCardLost({ userId: targetUser._id, cardId: card.id }).unwrap();
      setCards((current) => current.map((entry) => (entry.id === card.id ? { ...entry, ...updated } : entry)));
      resetLost();
    } catch (mutationError) {
      setFormError(userMutationError(mutationError, t, t("users.cardLostError")));
    }
  };

  return {
    targetUser,
    cards,
    activeCount,
    limitReached,
    cardNumber,
    setCardNumber,
    formError,
    isAdding,
    isMarkingLost,
    openCards,
    close,
    submitCard,
    markLost,
  };
};
