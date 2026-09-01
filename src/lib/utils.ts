import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const DEFAULT_LOGO_URL =
  "https://vibe.filesafe.space/1785896143476160753/attachments/0e7b75d6-871a-4dea-b7b3-8806a60cd9a5.png";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseRegions(regionData: any): string[] {
  if (!regionData) return [];

  const safeParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  let parsedArray: any[] = [];

  if (typeof regionData === "string") {
    const parsed = safeParse(regionData);
    if (Array.isArray(parsed)) {
      parsedArray = parsed;
    } else {
      return regionData
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } else if (Array.isArray(regionData)) {
    parsedArray = regionData;
  } else {
    return [];
  }

  const finalRegions = new Set<string>();

  for (const item of parsedArray) {
    if (typeof item === "string") {
      const parsedItem = safeParse(item);
      if (Array.isArray(parsedItem)) {
        parsedItem.forEach((subItem) => {
          if (typeof subItem === "string" && subItem.trim()) {
            finalRegions.add(subItem.trim());
          }
        });
      } else if (item.trim()) {
        finalRegions.add(item.trim());
      }
    }
  }

  return Array.from(finalRegions);
}

export function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const playTone = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    };

    const now = ctx.currentTime;
    playTone(587.33, now); // D5
    playTone(880.0, now + 0.15); // A5

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (e) {
    console.warn("Audio play failed", e);
  }
}

export function getCompanyTimezone(): string {
  try {
    return localStorage.getItem("veydra_timezone") || "America/New_York";
  } catch (e) {
    return "America/New_York";
  }
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return "";

  // Check if it's an ISO date string
  if (
    timeStr.includes("T") &&
    (timeStr.includes("Z") || timeStr.includes("+") || timeStr.includes("-"))
  ) {
    try {
      return new Date(timeStr).toLocaleTimeString("en-US", {
        timeZone: getCompanyTimezone(),
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      // fallback
    }
  }

  // Check if it's already in AM/PM format
  if (
    timeStr.toLowerCase().includes("am") ||
    timeStr.toLowerCase().includes("pm")
  ) {
    return timeStr;
  }
  // Assume 24h format HH:mm
  const [hours, minutes] = timeStr.split(":");
  if (!hours || !minutes) return timeStr;

  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12;
  return `${h}:${minutes} ${ampm}`;
}

export function parseTimeTo24Hour(timeStr: string): string {
  if (!timeStr) return "";
  // If already HH:mm
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;

  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return timeStr; // Fallback

  let [, h, m, ampm] = match;
  let hours = parseInt(h, 10);

  if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
  if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${m}`;
}

export function generateGoogleCalendarUrl(assignment: any) {
  const title = encodeURIComponent(
    `${assignment.jobs?.weddings?.client_name || "Wedding"} - ${assignment.jobs?.role || "Job"}`,
  );
  const location = encodeURIComponent(
    assignment.jobs?.weddings?.location || "",
  );
  const details = encodeURIComponent(
    `Role: ${assignment.jobs?.role}\n\nPlease check the Veydra portal for full timeline and details.`,
  );

  let dates = "";
  if (assignment.jobs?.weddings?.date) {
    try {
      const datePart = assignment.jobs.weddings.date.split("T")[0];
      const [y, m, d] = datePart.split("-").map(Number);
      const weddingDate = new Date(y, m - 1, d);
      const dateStr = datePart.replace(/-/g, "");
      const nextDay = new Date(weddingDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDateStr = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, "0")}${String(nextDay.getDate()).padStart(2, "0")}`;
      dates = `&dates=${dateStr}/${nextDateStr}`;
    } catch (e) {
      // Ignore date parsing errors
    }
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${dates}`;
}

export function getRateCalculationTooltip(job: any, settings: any) {
  if (!job.hours || !job.role)
    return "Enter hours and role to calculate base rate.";

  const isPhoto = job.role.toLowerCase().includes("photo");
  const isVideo = job.role.toLowerCase().includes("video");

  const hourlyRate = isPhoto
    ? settings?.photo_pay_rate
    : isVideo
      ? settings?.video_pay_rate
      : null;

  if (!hourlyRate) return "Global hourly rate not set in Admin Settings.";

  const baseRate = job.hours * hourlyRate;
  let breakdown = `Base: ${job.hours} hrs @ $${hourlyRate}/hr = $${baseRate}`;

  let addonsTotal = 0;
  if (job.addons?.includes("Drone Operator")) {
    addonsTotal += 50;
    breakdown += `\n+ $50 (Drone Operator)`;
  }
  if (job.addons?.includes("Audio & Vows")) {
    addonsTotal += 25;
    breakdown += `\n+ $25 (Audio & Vows)`;
  }

  const calculatedTotal = baseRate + addonsTotal;
  if (addonsTotal > 0) {
    breakdown += `\nTotal Calculated: $${calculatedTotal}`;
  }

  if (
    job.pay_rate !== calculatedTotal &&
    job.pay_rate !== undefined &&
    job.pay_rate !== null &&
    job.pay_rate !== ""
  ) {
    breakdown += `\n\nNote: Current rate ($${job.pay_rate}) was manually modified.`;
  }

  return breakdown;
}

export function formatDisplayDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "TBD";
  try {
    // If it's just a date without time (e.g., "2024-06-14")
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      const [year, month, day] = dateStr.trim().split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("en-US");
    }

    // If it has a time component (e.g., "2024-06-15T02:00:00Z")
    // First check if it's midnight — if so, just use the date part to avoid timezone shift
    const dateOnly = dateStr.trim().split("T")[0];
    const timePart = dateStr.trim().split("T")[1] || "";
    if (/^00:00:00/.test(timePart)) {
      const [year, month, day] = dateOnly.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("en-US");
    }

    // Convert to company timezone to get the correct local date
    return new Date(dateStr).toLocaleDateString("en-US", {
      timeZone: getCompanyTimezone(),
    });
  } catch (e) {
    return "TBD";
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return "TBD";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      timeZone: getCompanyTimezone(),
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (e) {
    return new Date(dateStr).toLocaleString();
  }
}

export function extractStartTimeFromTimeline(
  timeline: string | undefined | null,
): string | null {
  if (!timeline) return null;
  // Look for the first time pattern like "1:00 PM", "13:00", "01:00 PM"
  const timeRegex =
    /\b((1[0-2]|0?[1-9]):[0-5][0-9]\s*([AaPp][Mm])?|([01]?[0-9]|2[0-3]):[0-5][0-9])\b/;
  const match = timeline.match(timeRegex);
  return match ? match[0] : null;
}

export function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return "";
  const cleaned = ("" + phone).replace(/\D/g, "");
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return "(" + match[1] + ") " + match[2] + "-" + match[3];
  }
  return phone;
}

export const generatePaymentSchedule = (
  totalPrice: number,
  paymentOption: string,
  weddingDate: string,
  createdAt: string,
  paidAmount: number,
  customPlan?: any,
) => {
  if (!weddingDate) return [];
  let start;
  if (createdAt) {
    if (createdAt.includes("T")) {
      const d = new Date(createdAt);
      start = new Date(
        d.toLocaleDateString("en-US", {
          timeZone: getCompanyTimezone(),
        }),
      );
    } else {
      const [y, m, d] = createdAt.split("-").map(Number);
      start = new Date(y, m - 1, d);
    }
  } else {
    start = new Date();
  }

  // Handle custom payment plan (whether customPlan is an object or stringified JSON)
  let parsedCustom = customPlan;
  if (typeof customPlan === "string") {
    try {
      parsedCustom = JSON.parse(customPlan);
    } catch (e) {
      parsedCustom = null;
    }
  }

  if (
    paymentOption === "custom" ||
    (parsedCustom &&
      parsedCustom.enabled &&
      Array.isArray(parsedCustom.installments))
  ) {
    const depositAmount = Number(parsedCustom?.deposit) || 0;
    const schedule = [];

    if (depositAmount > 0) {
      schedule.push({
        date: start.toLocaleDateString("en-US"),
        amount: depositAmount,
        label: "Initial Retainer",
        status: paidAmount >= depositAmount ? "paid" : "pending",
      });
    }

    let coveredSoFar = depositAmount;
    const installments = (parsedCustom?.installments || []).map(
      (inst: any, idx: number) => {
        const instAmount = Number(inst.amount) || 0;
        coveredSoFar += instAmount;
        // Precision tolerance for floating point comparisons
        const isPaid = paidAmount >= coveredSoFar - 0.5;
        return {
          date: inst.date
            ? inst.date.includes("/")
              ? inst.date
              : new Date(inst.date + "T12:00:00").toLocaleDateString("en-US")
            : "TBD",
          amount: instAmount,
          label: inst.label || `Installment #${idx + 1}`,
          status: isPaid ? "paid" : "pending",
        };
      },
    );

    return schedule.length > 0 || installments.length > 0
      ? [...schedule, ...installments]
      : [];
  }

  const schedule = [];

  const datePart = weddingDate.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  const wedding = new Date(year, month - 1, day);

  const tenDaysBefore = new Date(wedding);
  tenDaysBefore.setDate(tenDaysBefore.getDate() - 10);

  if (paymentOption === "full") {
    // If paidAmount is within $1 or 5% of totalPrice (or greater), consider it paid to handle small rounding or pay-in-full discount mismatches
    const isPaidInFull =
      paidAmount > 0 &&
      (paidAmount >= totalPrice - 1 || paidAmount >= totalPrice * 0.945);
    return [
      {
        date: start.toLocaleDateString("en-US"),
        amount: totalPrice,
        label: "Pay in Full",
        status: isPaidInFull ? "paid" : "pending",
      },
    ];
  }

  if (paymentOption === "half" || paymentOption === "fifty_fifty") {
    schedule.push({
      date: start.toLocaleDateString("en-US"),
      amount: totalPrice / 2,
      label: "50% Deposit",
      status: paidAmount >= totalPrice / 2 ? "paid" : "pending",
    });
    schedule.push({
      date: tenDaysBefore.toLocaleDateString("en-US"),
      amount: totalPrice / 2,
      label: "Final Balance",
      status: paidAmount >= totalPrice ? "paid" : "pending",
    });
    return schedule;
  }

  if (
    paymentOption === "deposit" ||
    paymentOption === "monthly" ||
    paymentOption === "quarterly"
  ) {
    schedule.push({
      date: start.toLocaleDateString("en-US"),
      amount: 99,
      label: "Initial Retainer",
      status: paidAmount >= 99 ? "paid" : "pending",
      rawDate: new Date(start),
    });

    let remaining = totalPrice - 99;
    let currentDate = new Date(start);
    currentDate.setMonth(currentDate.getMonth() + 1);
    let amountCovered = 99; // Retainer

    while (currentDate < tenDaysBefore && remaining > 0) {
      const amount = Math.min(250, remaining);
      amountCovered += amount;
      schedule.push({
        date: currentDate.toLocaleDateString("en-US"),
        amount: amount,
        label: "Installment",
        status: paidAmount >= amountCovered ? "paid" : "pending",
        rawDate: new Date(currentDate),
      });
      remaining -= amount;

      if (paymentOption === "quarterly") {
        currentDate.setMonth(currentDate.getMonth() + 3);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    if (remaining > 0) {
      amountCovered += remaining;
      schedule.push({
        date: tenDaysBefore.toLocaleDateString("en-US"),
        amount: remaining,
        label: "Final Balance",
        status: paidAmount >= amountCovered ? "paid" : "pending",
        rawDate: new Date(tenDaysBefore),
      });
    }
    return schedule;
  }

  // Fallback for any unknown payment plan or default: generate at least one single payment entry
  return [
    {
      date: start.toLocaleDateString("en-US"),
      amount: totalPrice,
      label: "Package Payment",
      status: paidAmount >= totalPrice ? "paid" : "pending",
    },
  ];
};

export function generateHTMLReceipt(
  companyName: string,
  clientName: string,
  amountPaid: number,
  paymentPlan: string,
  packageName: string,
  addons: string[],
  totalPrice: number,
  invoicePdfUrl?: string,
) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const addonsList = addons.length > 0 ? addons.join(", ") : "None";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Receipt</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f9f9f9;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <h2 style="text-align: center; color: #222; margin-bottom: 20px;">Payment Receipt</h2>
        <p>Hi ${clientName},</p>
        <p>Thank you for your payment. Here are the details of your recent transaction with <strong>${companyName}</strong>.</p>
        
        <div style="background-color: #f4f4f5; padding: 20px; border-radius: 6px; margin: 25px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #555;">Date</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: bold;">${dateStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #555;">Amount Paid Today</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: bold; color: #16a34a;">$${amountPaid.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #555;">Payment Plan</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right;">${paymentPlan}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #555;">Package</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right;">${packageName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #555;">Add-ons</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; text-align: right;">${addonsList}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555;">Total Investment</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${totalPrice.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        ${
          invoicePdfUrl
            ? `
          <div style="text-align: center; margin: 25px 0;">
            <a href="${invoicePdfUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-block;">
              Download Official Stripe Invoice PDF
            </a>
          </div>
        `
            : ""
        }
        
        <p style="margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
          If you have any questions about this receipt, please contact us.
        </p>
      </div>
    </body>
    </html>
  `;
}
