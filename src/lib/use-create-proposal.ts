import { useState } from "react";
import { supabase } from "./supabase";
import { api } from "./api";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { needsCoverage } from "./coverage";

export interface CreateProposalArgs {
  id?: string | undefined;
  upgradeWeddingId?: string | null;
  formData: any;
  customItems: any[];
  totalPrice: number;
  amountPaidSoFar: number;
  customPlanBlocked: boolean;
  planBalance: any;
}

export function useCreateProposal() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proposalLink, setProposalLink] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [coverageConfirmed, setCoverageConfirmed] = useState(false);
  const [savedProposal, setSavedProposal] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadCoverageState = async (proposalId: string) => {
    try {
      const { data } = await supabase
        .from("proposals")
        .select("coverage_confirmed_at")
        .eq("id", proposalId)
        .single();
      setCoverageConfirmed(!!(data as any)?.coverage_confirmed_at);
    } catch {
      /* ignore */
    }
  };

  // Insert-or-update the proposal and return the saved row. Does NOT
  // navigate or open the share modal — used by the coverage flow so the
  // yellow card can request coverage against a real proposal id.
  const saveDraft = async (args: CreateProposalArgs) => {
    const {
      id,
      upgradeWeddingId,
      formData,
      customItems,
      totalPrice,
      amountPaidSoFar,
    } = args;

    let snapshotTemplate: string | null = null;
    try {
      const { data: settingsData } = await supabase
        .from("portal_settings")
        .select("wedding_contract_template")
        .single();
      if (settingsData && (settingsData as any).wedding_contract_template) {
        snapshotTemplate = (settingsData as any).wedding_contract_template;
      }
    } catch (e) {
      console.warn("Could not fetch wedding_contract_template snapshot:", e);
    }

    const payload = {
      client_name: formData.clientName,
      client_email: formData.clientEmail,
      client_phone: formData.clientPhone,
      partner_name: formData.partnerName,
      wedding_date: formData.weddingDate,
      is_lgbtq: formData.isLgbtq,
      venue: formData.venue,
      venue_address: formData.venueAddress,
      city: formData.city,
      state: formData.state,
      coverage_type: formData.coverageType,
      package_id: formData.packageId,
      addons: formData.addons,
      second_shooter_hours: formData.secondShooterHours,
      second_shooter_type: formData.secondShooterType,
      total_amount: totalPrice,
      notes: formData.notes,
      custom_prices: {
        discount: formData.customDiscount,
        discountType: formData.customDiscountType,
        items: customItems,
      },
      custom_payment_plan: formData.customPaymentPlan.enabled
        ? {
            enabled: true,
            deposit: formData.customPaymentPlan.deposit,
            installments: formData.customPaymentPlan.installments,
          }
        : { enabled: false, deposit: 0, installments: [] },
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_upgrade: !!upgradeWeddingId,
      original_wedding_id: upgradeWeddingId || null,
      amount_paid_so_far: amountPaidSoFar,
      ...(snapshotTemplate
        ? { custom_contract_snapshot: snapshotTemplate }
        : {}),
    };

    if (id) {
      const { data, error } = await supabase
        .from("proposals")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message || JSON.stringify(error));
      if (!data)
        throw new Error(
          "Update returned no data — the row may be blocked by a database policy.",
        );
      return data;
    }

    const { data, error } = await supabase
      .from("proposals")
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message || JSON.stringify(error));
    if (!data) throw new Error("Proposal insert returned no data.");
    return data;
  };

  const handleCreateProposal = async (
    args: CreateProposalArgs,
    opts?: { sendAnyway?: boolean },
  ) => {
    const sendAnyway = opts?.sendAnyway ?? false;
    const {
      id,
      upgradeWeddingId,
      formData,
      customItems,
      totalPrice,
      amountPaidSoFar,
      customPlanBlocked,
      planBalance,
    } = args;

    if (
      !formData.clientName ||
      !formData.clientEmail ||
      !formData.clientPhone ||
      !formData.weddingDate ||
      !formData.city ||
      !formData.state ||
      (!formData.packageId && customItems.length === 0)
    ) {
      toast({
        title: "Missing Fields",
        description:
          "Please fill out all required fields (name, email, phone, wedding date, city, state) and select a package or add custom items.",
        variant: "destructive",
      });
      return;
    }

    if (customPlanBlocked) {
      toast({
        title: "Custom plan doesn't match total",
        description:
          planBalance.short > 0
            ? `Schedule the remaining $${planBalance.short.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} before saving.`
            : `Installments exceed the contract by $${planBalance.over.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Short-notice + not confirmed: save as draft only. Pay rate / region
      // are collected inline on the yellow card (ProposalCoverageBlock), not
      // here. Navigate to the EDIT page for the saved proposal so staff can
      // fill pay + region and click Request Coverage Now. Do NOT call
      // requestCoverage here and do NOT jump to the empty coverage tab.
      if (
        needsCoverage(formData.weddingDate) &&
        !coverageConfirmed &&
        !sendAnyway
      ) {
        const saved = await saveDraft(args);
        setSavedProposal(saved);
        if (saved?.id) {
          await loadCoverageState(saved.id);
        }
        toast({
          title: "Proposal saved — awaiting coverage",
          description:
            "Fill pay + region on the yellow card, then Request Coverage Now.",
        });
        navigate(`/manager/proposals/${saved?.id || ""}`);
        return;
      }

      let snapshotTemplate: string | null = null;
      try {
        const { data: settingsData } = await supabase
          .from("portal_settings")
          .select("wedding_contract_template")
          .single();
        if (settingsData && (settingsData as any).wedding_contract_template) {
          snapshotTemplate = (settingsData as any).wedding_contract_template;
        }
      } catch (e) {
        console.warn("Could not fetch wedding_contract_template snapshot:", e);
      }

      const payload = {
        client_name: formData.clientName,
        client_email: formData.clientEmail,
        client_phone: formData.clientPhone,
        partner_name: formData.partnerName,
        wedding_date: formData.weddingDate,
        is_lgbtq: formData.isLgbtq,
        venue: formData.venue,
        venue_address: formData.venueAddress,
        city: formData.city,
        state: formData.state,
        coverage_type: formData.coverageType,
        package_id: formData.packageId,
        addons: formData.addons,
        second_shooter_hours: formData.secondShooterHours,
        second_shooter_type: formData.secondShooterType,
        total_amount: totalPrice,
        notes: formData.notes,
        custom_prices: {
          discount: formData.customDiscount,
          discountType: formData.customDiscountType,
          items: customItems,
        },
        custom_payment_plan: formData.customPaymentPlan.enabled
          ? {
              enabled: true,
              deposit: formData.customPaymentPlan.deposit,
              installments: formData.customPaymentPlan.installments,
            }
          : { enabled: false, deposit: 0, installments: [] },
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        is_upgrade: !!upgradeWeddingId,
        original_wedding_id: upgradeWeddingId || null,
        amount_paid_so_far: amountPaidSoFar,
        ...(snapshotTemplate
          ? { custom_contract_snapshot: snapshotTemplate }
          : {}),
      };

      if (id) {
        const { data: updateData, error } = await supabase
          .from("proposals")
          .update(payload)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("Supabase update error:", JSON.stringify(error));
          throw new Error(error.message || JSON.stringify(error));
        }
        if (!updateData) {
          throw new Error(
            "Update returned no data — the row may be blocked by a database policy. Please run the SQL policy fix in Supabase.",
          );
        }
        toast({
          title: "Proposal Updated",
          description: "The proposal has been successfully updated.",
        });
        api.logAdminActivity(
          "Proposal Updated",
          `Updated proposal for ${formData.clientName} ($${totalPrice})`,
        );
        navigate("/manager/proposals");
      } else {
        const { data, error } = await supabase
          .from("proposals")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        const link = `${window.location.origin}/proposal/${data.id}`;
        setProposalLink(link);
        setSavedProposal(data);
        api.logAdminActivity(
          "Proposal Created",
          `Generated new proposal for ${formData.clientName} ($${totalPrice})`,
        );

        setShareOpen(true);
        toast({
          title: "Proposal Created",
          description: "The proposal has been successfully generated.",
        });
      }
    } catch (err: any) {
      console.error("Error creating proposal:", err);
      api.logAdminActivity(
        "Proposal Error",
        `Failed to create/update proposal for ${formData.clientName}: ${err.message}`,
      );
      toast({
        title: "Error",
        description: err.message || "Failed to create proposal.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    proposalLink,
    shareOpen,
    setShareOpen,
    coverageConfirmed,
    setCoverageConfirmed,
    savedProposal,
    loadCoverageState,
    handleCreateProposal,
    saveDraft,
  };
}
