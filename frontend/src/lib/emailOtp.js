/**
 * emailOtp.js
 *
 * Sends a 6-digit OTP via EmailJS, stores SHA-256 hash in sessionStorage,
 * and exposes verifyOtp() / clearOtp() for client-side verification.
 */
import emailjs from "@emailjs/browser";

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || "service_k227m25";
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_0k76cas";
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || "3rgUlR-kpeU78CfIG";

// Log at module load so we can confirm env vars are present
console.log("[EmailJS] SERVICE_ID :", SERVICE_ID);
console.log("[EmailJS] TEMPLATE_ID:", TEMPLATE_ID);
console.log("[EmailJS] PUBLIC_KEY :", PUBLIC_KEY ? PUBLIC_KEY.slice(0, 6) + "…" : "MISSING");

// Initialise once — works for both v3 and v4 of @emailjs/browser
if (PUBLIC_KEY) {
  emailjs.init(PUBLIC_KEY); // v3 style; harmless on v4
}

const OTP_KEY     = "vs_otp_hash";
const OTP_EXP_KEY = "vs_otp_exp";
const OTP_TTL_MS  = 10 * 60 * 1000; // 10 minutes

/** Cryptographically random 6-digit string */
function generateOtp() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

/** SHA-256 hash of an OTP string (so we never store the raw code) */
async function hashOtp(otp) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(otp)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate + send an OTP to the given email address via EmailJS.
 * The hash and expiry are stored in sessionStorage for later verification.
 *
 * Template variables expected by EmailJS:
 *   {{otp_code}}  — the 6-digit code
 *   {{to_email}}  — destination address
 *   {{to_name}}   — recipient first name
 */
export async function sendOtp(email, name = "there") {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error(
      "EmailJS is not configured. " +
      "Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, " +
      "and VITE_EMAILJS_PUBLIC_KEY in your frontend/.env.local file, " +
      "then restart the Vite dev server."
    );
  }

  const otp  = generateOtp();
  const hash = await hashOtp(otp);

  // Store before sending to avoid race conditions
  sessionStorage.setItem(OTP_KEY,     hash);
  sessionStorage.setItem(OTP_EXP_KEY, String(Date.now() + OTP_TTL_MS));

  const templateParams = {
    to_email:  email,
    to_name:   name,
    otp_code:  otp,
  };

  console.log("[EmailJS] Sending OTP to", email, "via service", SERVICE_ID, "/ template", TEMPLATE_ID);

  try {
    // Use the public-key string as the 4th arg — compatible with both v3 and v4
    const result = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log("[EmailJS] Send result:", result.status, result.text);
  } catch (err) {
    // Surface the raw EmailJS error so the user can debug IDs
    console.error("[EmailJS] Send failed:", err);
    throw new Error(
      `EmailJS error (${err.status ?? "?"}): ${err.text ?? err.message ?? "Unknown error"}. ` +
      "Check your Service ID, Template ID, and Public Key in the EmailJS dashboard."
    );
  }
}

/**
 * Verify the code the user typed against the stored hash.
 * Returns { ok: true } on success, { ok: false, reason: "..." } on failure.
 */
export async function verifyOtp(inputOtp) {
  const stored = sessionStorage.getItem(OTP_KEY);
  const expiry = Number(sessionStorage.getItem(OTP_EXP_KEY) || "0");

  if (!stored) {
    return { ok: false, reason: "No OTP found. Please request a new code." };
  }
  if (Date.now() > expiry) {
    clearOtp();
    return { ok: false, reason: "Code expired. Please request a new one." };
  }

  const inputHash = await hashOtp(inputOtp.trim());
  if (inputHash !== stored) {
    return { ok: false, reason: "Incorrect or expired code. Please try again." };
  }

  clearOtp(); // one-time use — consume immediately
  return { ok: true };
}

/** Delete the stored OTP from sessionStorage */
export function clearOtp() {
  sessionStorage.removeItem(OTP_KEY);
  sessionStorage.removeItem(OTP_EXP_KEY);
}
