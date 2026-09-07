import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });
}

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  if (digits.startsWith("7") && digits.length === 9) {
    return `254${digits}`;
  }

  if (digits.startsWith("1") && digits.length === 9) {
    return `254${digits}`;
  }

  throw new Error(
    "Enter a valid Kenyan M-Pesa number, for example 0712345678.",
  );
}

function timestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";

  return (
    `${value("year")}` +
    `${value("month")}` +
    `${value("day")}` +
    `${value("hour")}` +
    `${value("minute")}` +
    `${value("second")}`
  );
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

Deno.serve(async (req) => {
  /*
   * ---------------------------------------------------------
   * CORS / HTTP METHOD
   * ---------------------------------------------------------
   */

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: cors,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed",
        expected: "POST",
      },
      405,
    );
  }

  /*
   * ---------------------------------------------------------
   * ENVIRONMENT
   * ---------------------------------------------------------
   */

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const consumerKey = Deno.env.get("DARAJA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("DARAJA_CONSUMER_SECRET");
  const passkey = Deno.env.get("DARAJA_PASSKEY");
  const callbackUrl = Deno.env.get("DARAJA_CALLBACK_URL");

  const configuredShortcode = Deno.env.get("DARAJA_SHORTCODE")?.trim() || "";

  const environment = (Deno.env.get("DARAJA_ENVIRONMENT") || "sandbox")
    .trim()
    .toLowerCase();

  /*
   * IMPORTANT:
   *
   * For Daraja sandbox testing, the normal sandbox shortcode is
   * 174379.
   *
   * For production, use YOUR actual Safaricom PayBill/Till shortcode.
   *
   * We deliberately do not silently use the old 4080693 fallback.
   */

  const shortcode =
    configuredShortcode || (environment === "sandbox" ? "174379" : "");

  /*
   * ---------------------------------------------------------
   * CONFIGURATION VALIDATION
   * ---------------------------------------------------------
   */

  const missingSecrets: string[] = [];

  if (!supabaseUrl) missingSecrets.push("SUPABASE_URL");
  if (!serviceRoleKey) missingSecrets.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!anonKey) missingSecrets.push("SUPABASE_ANON_KEY");

  if (!consumerKey) missingSecrets.push("DARAJA_CONSUMER_KEY");
  if (!consumerSecret) missingSecrets.push("DARAJA_CONSUMER_SECRET");
  if (!passkey) missingSecrets.push("DARAJA_PASSKEY");
  if (!callbackUrl) missingSecrets.push("DARAJA_CALLBACK_URL");
  if (!shortcode) missingSecrets.push("DARAJA_SHORTCODE");

  if (missingSecrets.length > 0) {
    console.error("M-Pesa configuration incomplete:", missingSecrets);

    return json(
      {
        error: "M-Pesa integration is not fully configured.",
        setupRequired: true,
        missing: missingSecrets,
      },
      503,
    );
  }

  if (environment !== "sandbox" && environment !== "production") {
    return json(
      {
        error: 'DARAJA_ENVIRONMENT must be either "sandbox" or "production".',
        received: environment,
      },
      500,
    );
  }

  /*
   * ---------------------------------------------------------
   * AUTHENTICATE CURRENT USER
   * ---------------------------------------------------------
   */

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return json(
      {
        error: "Authentication required.",
      },
      401,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    console.error(
      "Authentication failed:",
      authError?.message || "No authenticated user",
    );

    return json(
      {
        error: "Authentication required.",
      },
      401,
    );
  }

  /*
   * ---------------------------------------------------------
   * READ REQUEST
   * ---------------------------------------------------------
   */

  let body: {
    payment_id?: string;
    phone?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json(
      {
        error: "Invalid JSON request body.",
      },
      400,
    );
  }

  const paymentId = String(body.payment_id || "").trim();
  const rawPhone = String(body.phone || "").trim();

  if (!paymentId) {
    return json(
      {
        error: "payment_id is required.",
      },
      400,
    );
  }

  if (!rawPhone) {
    return json(
      {
        error: "phone is required.",
      },
      400,
    );
  }

  /*
   * ---------------------------------------------------------
   * NORMALIZE PHONE
   * ---------------------------------------------------------
   */

  let phone: string;

  try {
    phone = normalizePhone(rawPhone);
  } catch (error) {
    return json(
      {
        error: safeError(error),
      },
      400,
    );
  }

  /*
   * ---------------------------------------------------------
   * DATABASE CLIENT
   * ---------------------------------------------------------
   */

  const admin = createClient(supabaseUrl, serviceRoleKey);

  /*
   * ---------------------------------------------------------
   * FIND PAYMENT
   *
   * IMPORTANT:
   * We intentionally do NOT put all conditions into the initial
   * Supabase query.
   *
   * This allows us to tell the difference between:
   *
   * - payment doesn't exist
   * - wrong user
   * - wrong payment method
   * - payment already processed
   *
   * The previous implementation turned all of these into the
   * same generic 404.
   * ---------------------------------------------------------
   */

  const { data: payment, error: paymentLookupError } = await admin
    .from("payments")
    .select(
      `
      id,
      user_id,
      invoice_id,
      payment_method,
      status,
      verified,
      amount,
      payment_type,
      receipt_number
    `,
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentLookupError) {
    console.error("Payment lookup failed:", paymentLookupError);

    return json(
      {
        error: "Could not look up the payment.",
        database_error: paymentLookupError.message,
        payment_id: paymentId,
      },
      500,
    );
  }

  if (!payment) {
    console.error("Payment does not exist:", paymentId);

    return json(
      {
        error: "The payment record does not exist.",
        payment_id: paymentId,
      },
      404,
    );
  }

  /*
   * ---------------------------------------------------------
   * VERIFY PAYMENT OWNERSHIP
   * ---------------------------------------------------------
   */

  if (payment.user_id !== user.id) {
    console.error("Payment belongs to a different user:", {
      paymentId,
      paymentUserId: payment.user_id,
      authenticatedUserId: user.id,
    });

    return json(
      {
        error:
          "This payment does not belong to the currently signed-in account.",
      },
      403,
    );
  }

  /*
   * ---------------------------------------------------------
   * VERIFY PAYMENT METHOD
   * ---------------------------------------------------------
   */

  if (payment.payment_method !== "mpesa") {
    return json(
      {
        error: "This payment was not created as an M-Pesa payment.",
        payment_method: payment.payment_method,
      },
      400,
    );
  }

  /*
   * ---------------------------------------------------------
   * VERIFY PAYMENT STATUS
   * ---------------------------------------------------------
   */

  if (payment.status !== "pending") {
    return json(
      {
        error:
          "This payment is no longer pending and cannot start a new M-Pesa request.",
        status: payment.status,
        verified: payment.verified,
      },
      409,
    );
  }

  /*
   * ---------------------------------------------------------
   * VALIDATE AMOUNT
   * ---------------------------------------------------------
   */

  const amount = Math.max(1, Math.round(Number(payment.amount)));

  if (!Number.isFinite(amount) || amount <= 0) {
    return json(
      {
        error: "The payment amount is invalid.",
      },
      400,
    );
  }

  /*
   * ---------------------------------------------------------
   * DARaja API BASE URL
   * ---------------------------------------------------------
   */

  const authBase =
    environment === "sandbox"
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

  console.log("Starting M-Pesa STK request:", {
    environment,
    shortcode,
    paymentId,
    amount,
    phoneSuffix: phone.slice(-4),
  });

  /*
   * ---------------------------------------------------------
   * GET DARaja ACCESS TOKEN
   * ---------------------------------------------------------
   */

  const basicCredentials = btoa(`${consumerKey}:${consumerSecret}`);

  let tokenResponse: Response;

  try {
    tokenResponse = await fetch(
      `${authBase}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicCredentials}`,
        },
      },
    );
  } catch (error) {
    console.error("Daraja OAuth network error:", error);

    return json(
      {
        error: "Could not connect to Safaricom Daraja.",
        details: safeError(error),
      },
      502,
    );
  }

  const tokenJson = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenJson.access_token) {
    console.error("Daraja OAuth failed:", {
      status: tokenResponse.status,
      response: tokenJson,
    });

    return json(
      {
        error: "Safaricom Daraja authentication failed.",
        provider_status: tokenResponse.status,
        provider:
          tokenJson?.error_description ||
          tokenJson?.error ||
          tokenJson?.message ||
          "No access token returned.",
      },
      502,
    );
  }

  /*
   * ---------------------------------------------------------
   * CREATE STK PASSWORD
   * ---------------------------------------------------------
   */

  const time = timestamp();

  const password = btoa(`${shortcode}${passkey}${time}`);

  /*
   * ---------------------------------------------------------
   * STK PUSH
   * ---------------------------------------------------------
   */

  const stkPayload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: time,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference:
      payment.receipt_number || `HP-${payment.id.slice(0, 8).toUpperCase()}`,
    TransactionDesc: `HighPark Consult ${payment.payment_type || "Payment"}`,
  };

  console.log("Sending STK request to Daraja:", {
    environment,
    shortcode,
    amount,
    paymentId,
    callbackConfigured: Boolean(callbackUrl),
  });

  let stkResponse: Response;

  try {
    stkResponse = await fetch(`${authBase}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });
  } catch (error) {
    console.error("Daraja STK network error:", error);

    return json(
      {
        error: "Could not connect to the Safaricom STK service.",
        details: safeError(error),
      },
      502,
    );
  }

  const stk = await stkResponse.json().catch(() => ({}));

  /*
   * ---------------------------------------------------------
   * HANDLE SAFARICOM RESPONSE
   * ---------------------------------------------------------
   */

  if (!stkResponse.ok || String(stk.ResponseCode || "") !== "0") {
    console.error("Safaricom rejected STK request:", {
      httpStatus: stkResponse.status,
      responseCode: stk?.ResponseCode,
      responseDescription: stk?.ResponseDescription,
      errorCode: stk?.errorCode,
      errorMessage: stk?.errorMessage,
    });

    return json(
      {
        error:
          stk?.errorMessage ||
          stk?.ResponseDescription ||
          "Safaricom rejected the STK request.",
        provider_status: stkResponse.status,
        provider_code: stk?.ResponseCode || stk?.errorCode || null,
      },
      502,
    );
  }

  /*
   * ---------------------------------------------------------
   * SAVE STK TRACKING INFORMATION
   * ---------------------------------------------------------
   */

  const { error: updateError } = await admin
    .from("payments")
    .update({
      payer_phone: phone,
      merchant_request_id: stk.MerchantRequestID || null,
      checkout_request_id: stk.CheckoutRequestID || null,
      provider_response: stk,
      initiated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("Could not save STK tracking information:", updateError);

    return json(
      {
        error:
          "Safaricom accepted the STK request, but payment tracking could not be saved.",
        checkout_request_id: stk.CheckoutRequestID || null,
      },
      500,
    );
  }

  /*
   * ---------------------------------------------------------
   * SUCCESS
   * ---------------------------------------------------------
   */

  console.log("STK request accepted:", {
    paymentId: payment.id,
    checkoutRequestId: stk.CheckoutRequestID || null,
  });

  return json({
    accepted: true,
    payment_id: payment.id,
    checkout_request_id: stk.CheckoutRequestID || null,
    merchant_request_id: stk.MerchantRequestID || null,
    customer_message:
      stk.CustomerMessage || "Enter your M-Pesa PIN on your phone.",
  });
});
