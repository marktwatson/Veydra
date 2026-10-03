import { useEffect } from "react";
import confetti from "canvas-confetti";
import { api } from "./api";

/**
 * Fires the booking-confirmed confetti burst for ~3s and fulfills the
 * proposal payment when the success flag flips on. Extracted from
 * ProposalReview to keep that page focused.
 */
export function useProposalConfetti(isSuccess: boolean, proposalId?: string) {
  useEffect(() => {
    if (!isSuccess) return;
    if (proposalId) {
      api.fulfillProposalPayment(proposalId).catch(console.error);
    }

    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 100,
    };
    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;
    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        }),
      );
      confetti(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        }),
      );
    }, 250);
    return () => clearInterval(interval);
  }, [isSuccess, proposalId]);
}
