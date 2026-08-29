// --------------------------------------------------
// SMS Service — Multi-Provider Abstraction
// --------------------------------------------------
// Supports: mock | twilio | fast2sms
//
// Usage:
//   const { sendSms } = require("./services/smsService");
//   const result = await sendSms({ phone, message });
//
// Environment:
//   SMS_PROVIDER=mock|twilio|fast2sms
//   TWILIO_ACCOUNT_SID=...
//   TWILIO_AUTH_TOKEN=...
//   TWILIO_FROM_NUMBER=...
//   FAST2SMS_API_KEY=...
// --------------------------------------------------

/**
 * Convert 10-digit Indian mobile number to E.164 format.
 * @param {string} phone — raw phone string
 * @returns {string} — E.164 formatted number like +919789184459
 * @throws {Error} — if input is invalid
 */
function toE164Indian(phone) {
  if (!phone || typeof phone !== "string") {
    throw new Error("Phone number is required and must be a string.");
  }

  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If already has 91 prefix (12 digits)
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // Standard 10-digit Indian mobile
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  throw new Error(
    `Invalid Indian phone number: expected exactly 10 digits, got ${digits.length} digits from "${phone}".`
  );
}

/**
 * Mask phone number for safe logging/display.
 * +919789184459 → ******4459
 */
function maskPhone(phone) {
  if (!phone || phone.length < 4) return "****";
  return "******" + phone.slice(-4);
}

// ============================================================
// PROVIDER: MOCK
// ============================================================
async function sendViaMock({ phone, message }) {
  const phoneMasked = maskPhone(phone);
  console.log("[SmsService] MOCK provider — no real SMS sent.", {
    provider: "mock",
    phoneMasked,
    messageLength: message?.length || 0,
  });
  return {
    success: true,
    provider: "mock",
    status: "SIMULATED",
    requestId: `mock-${Date.now()}`,
    phoneMasked,
    providerStatus: "simulated",
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// PROVIDER: TWILIO
// ============================================================
//
// TRIAL MODE  (DEMO_ALERT_MODE=true):
//   Sends body exactly equal to "sms_event_notifications" — the predefined
//   trial template identifier accepted by Twilio's standard Messages API.
//   Custom flood-alert text is intentionally NOT sent through Twilio trial.
//   The detailed alert remains visible in the web dashboard.
//
// PRODUCTION MODE (DEMO_ALERT_MODE != "true"):
//   Sends the full custom flood-alert body via the standard Messages API.
//   Switch SMS_PROVIDER=twilio and upgrade the Twilio account to use this path.
//
// Per Twilio trial account rules:
//   - TWILIO_FROM_NUMBER must be your provisioned Twilio trial number.
//   - DEMO_TEST_PHONE must be a verified number in your Twilio Console.
//   - No ContentSid or MessagingServiceSid required.
// ============================================================
async function sendViaTwilio({ phone, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      provider: "twilio",
      status: "FAILED",
      requestId: null,
      phoneMasked: maskPhone(phone),
      errorCode: "MISSING_CONFIG",
      error: "Twilio configuration incomplete. Ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are set.",
      timestamp: new Date().toISOString(),
    };
  }

  let recipientE164;
  try {
    recipientE164 = toE164Indian(phone);
  } catch (err) {
    return {
      success: false,
      provider: "twilio",
      status: "FAILED",
      requestId: null,
      phoneMasked: maskPhone(phone),
      errorCode: "INVALID_PHONE",
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const twilio = require("twilio");
    const client  = twilio(accountSid, authToken);

    const isDemoMode = process.env.DEMO_ALERT_MODE === "true";

    // ── TRIAL PATH ────────────────────────────────────────────────────────────
    // body must be the exact predefined template identifier "sms_event_notifications".
    // Custom flood-alert text is kept in the web dashboard only.
    // ── PRODUCTION PATH ───────────────────────────────────────────────────────
    // body = full custom flood alert content (paid/upgraded account).
    const body = isDemoMode ? "sms_event_notifications" : message;

    if (isDemoMode) {
      console.log("[SmsService] Trial mode: sending predefined template identifier \"sms_event_notifications\".");
    } else {
      console.log("[SmsService] Production mode: sending custom flood-alert body.");
    }

    const result = await client.messages.create({
      body,
      from: fromNumber,
      to:   recipientE164,
    });

    const phoneMasked = maskPhone(recipientE164);

    console.log("[SmsService] Twilio response:", {
      provider     : "twilio",
      success      : true,
      status       : "ACCEPTED",
      requestId    : result.sid,
      providerStatus: result.status,
      phoneMasked,
    });

    return {
      success      : true,
      provider     : "twilio",
      status       : "ACCEPTED",
      requestId    : result.sid,
      phoneMasked,
      providerStatus: result.status,
      timestamp    : new Date().toISOString(),
    };
  } catch (err) {
    const phoneMasked = maskPhone(phone);

    console.error("[SmsService] Twilio error:", {
      provider    : "twilio",
      errorCode   : err.code    || null,
      errorMessage: err.message || "Unknown Twilio error",
      phoneMasked,
    });

    return {
      success  : false,
      provider : "twilio",
      status   : "FAILED",
      requestId: null,
      phoneMasked,
      errorCode: err.code    || null,
      error    : err.message || "Twilio SMS request failed.",
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================
// PROVIDER: FAST2SMS (preserved as optional fallback)
// ============================================================
async function sendViaFast2Sms({ phone, message }) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const phoneMasked = maskPhone(phone);

  if (!apiKey) {
    return {
      success: false,
      provider: "fast2sms",
      status: "FAILED",
      requestId: null,
      phoneMasked,
      errorCode: "MISSING_CONFIG",
      error: "FAST2SMS_API_KEY is not configured.",
      timestamp: new Date().toISOString(),
    };
  }

  // Strip to 10 digits for Fast2SMS (Indian domestic format)
  const digits = phone.replace(/\D/g, "");
  const domestic = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;

  if (domestic.length !== 10) {
    return {
      success: false,
      provider: "fast2sms",
      status: "FAILED",
      requestId: null,
      phoneMasked,
      errorCode: "INVALID_PHONE",
      error: `Invalid phone for Fast2SMS: expected 10 digits, got ${domestic.length}.`,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "q",
        message: message,
        language: "english",
        flash: 0,
        numbers: domestic,
      }),
    });

    const data = await response.json();

    if (data.return === true || data.status_code === 200) {
      console.log("[SmsService] Fast2SMS response:", {
        provider: "fast2sms",
        success: true,
        status: "ACCEPTED",
        requestId: data.request_id || null,
        phoneMasked,
      });

      return {
        success: true,
        provider: "fast2sms",
        status: "ACCEPTED",
        requestId: data.request_id || `fast2sms-${Date.now()}`,
        phoneMasked,
        providerStatus: "accepted",
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        success: false,
        provider: "fast2sms",
        status: "FAILED",
        requestId: null,
        phoneMasked,
        errorCode: data.status_code || null,
        error: data.message || "Fast2SMS rejected the request.",
        timestamp: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error("[SmsService] Fast2SMS error:", err.message);
    return {
      success: false,
      provider: "fast2sms",
      status: "FAILED",
      requestId: null,
      phoneMasked,
      errorCode: null,
      error: err.message || "Fast2SMS request failed.",
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================
// UNIFIED DISPATCH
// ============================================================

/**
 * Send an SMS via the configured provider.
 * @param {{ phone: string, message: string }} opts
 * @returns {Promise<object>} — normalized result
 */
async function sendSms({ phone, message }) {
  const provider = (process.env.SMS_PROVIDER || "mock").toLowerCase().trim();

  console.log(`[SmsService] Dispatching via provider: ${provider}`);

  switch (provider) {
    case "mock":
      return sendViaMock({ phone, message });

    case "twilio":
      return sendViaTwilio({ phone, message });

    case "fast2sms":
      return sendViaFast2Sms({ phone, message });

    default:
      return {
        success: false,
        provider,
        status: "FAILED",
        requestId: null,
        phoneMasked: maskPhone(phone),
        errorCode: "UNSUPPORTED_PROVIDER",
        error: `SMS provider "${provider}" is not supported. Use: mock, twilio, or fast2sms.`,
        timestamp: new Date().toISOString(),
      };
  }
}

/**
 * Look up the delivery status of a Twilio message by SID.
 * Returns null if Twilio is not configured or SID is invalid.
 */
async function lookupTwilioStatus(messageSid) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || !messageSid) return null;

  try {
    const twilio = require("twilio");
    const client = twilio(accountSid, authToken);
    const msg = await client.messages(messageSid).fetch();
    return {
      sid: msg.sid,
      status: msg.status,
      dateCreated: msg.dateCreated,
      dateSent: msg.dateSent,
      errorCode: msg.errorCode,
      errorMessage: msg.errorMessage,
    };
  } catch (err) {
    console.error("[SmsService] Twilio status lookup failed:", err.message);
    return null;
  }
}

module.exports = {
  sendSms,
  toE164Indian,
  maskPhone,
  lookupTwilioStatus,
};
