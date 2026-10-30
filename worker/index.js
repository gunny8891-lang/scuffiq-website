// ============================================================
// ScuffIQ quote worker (Cloudflare Worker: plain-math-71e8scuffiq-api)
// worker/index.js
//
// Copy of the deployed code. Change it here, then paste into
// Cloudflare: Workers & Pages → plain-math-71e8scuffiq-api → Edit code → Deploy.
//
// Requires the dents_repair column on quote_submissions:
//   alter table public.quote_submissions add column if not exists dents_repair text;
// ============================================================

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    // ── Route by URL path ──────────────────────────────────────────────────
    const url = new URL(request.url);

    if (url.pathname === "/send-confirmed-quote") {
      return handleConfirmedQuoteEmail(request, env, corsHeaders);
    }

    if (url.pathname === "/send-technician-job") {
      return handleTechnicianJobEmail(request, env, corsHeaders);
    }

    if (url.pathname === "/technician-application") {
      return handleTechnicianApplication(request, env, corsHeaders);
    }

    // Customer booking (see BOOKINGS section below)
    if (url.pathname === "/booking-slots") {
      return handleBookingSlots(request, env, corsHeaders);
    }

    if (url.pathname === "/booking-checkout") {
      return handleBookingCheckout(request, env, corsHeaders);
    }

    if (url.pathname === "/booking-request") {
      return handleBookingRequest(request, env, corsHeaders);
    }

    // Stripe calls this directly; it is checked with the webhook signing secret
    if (url.pathname === "/stripe-webhook") {
      return handleStripeWebhook(request, env);
    }

    // Default: handle new quote submission
    return handleNewQuote(request, env, corsHeaders);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER 1 — New quote submission
// ══════════════════════════════════════════════════════════════════════════════

async function handleNewQuote(request, env, corsHeaders) {
  try {
    const data = await request.json();

    const {
      customer_name,
      customer_email,
      customer_phone,
      vehicle_make,
      vehicle_model,
      postcode,
      service_type,
      dents_repair,
      photo_count,
      ai_summary,
      photos = [],
      ai_results = [],
    } = data;

    if (!customer_email || !customer_name) {
      return json({ success: false, error: "Missing customer details" }, 400, corsHeaders);
    }

    // ── Internal notification email ────────────────────────────────────────
    const internalHtml = `
      <h2>New ScuffIQ Quote Request</h2>
      <p><strong>Name:</strong> ${escapeHtml(customer_name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(customer_email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(customer_phone || "")}</p>
      <p><strong>Vehicle:</strong> ${escapeHtml(vehicle_make || "")} ${escapeHtml(vehicle_model || "")}</p>
      <p><strong>Postcode:</strong> ${escapeHtml(postcode || "")}</p>
      <p><strong>Service:</strong> ${escapeHtml(service_type || "")}</p>
      <p><strong>Dents require repair:</strong> ${escapeHtml(dents_repair || "Not answered")}</p>
      <p><strong>Photos uploaded:</strong> ${photo_count || photos.length}</p>
      <h3>AI Summary</h3>
      <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;">${escapeHtml(ai_summary || "No AI summary provided")}</pre>
    `;

    const firstName = escapeHtml((customer_name || "").split(" ")[0]);

    const customerHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quote Request Received — ScuffIQ</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0d0d0d; }
    body, td, th, p, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
    a { color: #00d4ff; text-decoration: none; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0d0d0d;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0d0d0d;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#111111;border:1px solid #222222;">

  <tr>
    <td align="center" style="background-color:#0a0a0a;padding:32px 40px 24px;border-bottom:3px solid #00d4ff;">
      <img src="https://scuffiq.com/scuffiq-logo.png" alt="ScuffIQ" width="140" style="display:block;margin:0 auto 14px;width:140px;height:auto;" />
      <p style="margin:0;font-size:11px;color:#888888;letter-spacing:1.5px;text-transform:uppercase;">Smart Repair Specialists</p>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 36px 0;background-color:#111111;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#001f2b;border:1px solid #003d5c;">
        <tr>
          <td valign="middle" style="padding:16px;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#00d4ff;">Quote request received</p>
            <p style="margin:0;font-size:12px;color:#667788;">We'll be in touch today</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:28px 36px 0;background-color:#111111;">
      <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#ffffff;">Hi ${firstName},</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#aaaaaa;">
        Thanks for getting in touch with ScuffIQ. We've received your photos and quote request — you're one step closer to having your car looking <span style="color:#e0e0e0;font-weight:600;">flawless again.</span>
      </p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#aaaaaa;">
        A certified ScuffIQ technician is reviewing your submission and will get back to you today with a personalised quote. We cover North London, South London, Hertfordshire and Essex.
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 36px 0;background-color:#111111;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#181818;border:1px solid #252525;">
        <tr>
          <td colspan="2" style="padding:12px 20px;background-color:#001a20;border-bottom:1px solid #003040;">
            <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00d4ff;">Your Request Summary</p>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Vehicle</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(vehicle_make || "")} ${escapeHtml(vehicle_model || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Service</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(service_type || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;">Response time</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#00d4ff;font-weight:600;text-align:right;">Same day</td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:28px 36px 36px;background-color:#111111;">
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#888888;">Have a question in the meantime? Just reply to this email — we're always happy to help.</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#888888;">
        Talk soon,<br />
        <span style="color:#00d4ff;font-weight:700;">The ScuffIQ Team</span>
      </p>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 36px;background-color:#0a0a0a;border-top:1px solid #1a1a1a;" align="center">
      <p style="margin:0 0 6px;font-size:12px;color:#444444;">
        ScuffIQ Ltd &middot; North &amp; South London, Hertfordshire &amp; Essex<br />
        <a href="mailto:hello@scuffiq.com" style="color:#00d4ff;">hello@scuffiq.com</a>&nbsp;&middot;&nbsp;<a href="https://www.scuffiq.com" style="color:#00d4ff;">scuffiq.com</a>
      </p>
      <p style="margin:0;font-size:11px;color:#333333;">You're receiving this because you submitted a quote request at scuffiq.com.</p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;

    const attachments = photos
      .filter(p => p && p.dataUrl && p.name)
      .slice(0, 6)
      .map(p => ({
        filename: p.name,
        content: p.dataUrl.split(",")[1],
      }));

    await sendResendEmail(env, {
      to: env.INTERNAL_EMAIL || "hello@scuffiq.com",
      subject: "New ScuffIQ Quote Request",
      html: internalHtml,
      attachments,
    });

    await sendResendEmail(env, {
      to: customer_email,
      subject: "We've received your ScuffIQ quote request",
      html: customerHtml,
    });

    let submissionId = null;
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      try {
        const imageUrls = [];
        const validPhotos = photos.filter(p => p && p.dataUrl && p.name).slice(0, 6);

        for (let i = 0; i < validPhotos.length; i++) {
          const photo = validPhotos[i];
          const base64Data = photo.dataUrl.split(",")[1];
          const byteString = atob(base64Data);
          const byteArray = new Uint8Array(byteString.length);
          for (let j = 0; j < byteString.length; j++) {
            byteArray[j] = byteString.charCodeAt(j);
          }

          const safeName = customer_name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
          const timestamp = Date.now();
          const ext = photo.name.split(".").pop() || "jpg";
          const fileName = `${timestamp}-${safeName}-photo${i + 1}.${ext}`;

          const uploadRes = await fetch(
            `${env.SUPABASE_URL}/storage/v1/object/quote-images/${fileName}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
                "Content-Type": photo.dataUrl.split(";")[0].split(":")[1] || "image/jpeg",
                "x-upsert": "false",
              },
              body: byteArray,
            }
          );

          if (uploadRes.ok) {
            imageUrls.push(`${env.SUPABASE_URL}/storage/v1/object/public/quote-images/${fileName}`);
          } else {
            imageUrls.push(null);
          }
        }

        const row = {
          customer_name,
          customer_email,
          customer_phone: customer_phone || null,
          vehicle_make:   vehicle_make || null,
          vehicle_model:  vehicle_model || null,
          postcode:       postcode || null,
          service_type:   service_type || null,
          dents_repair:   dents_repair || null,
          photo_count:    validPhotos.length,
        };

        imageUrls.forEach((url, i) => { row[`image_url_${i + 1}`] = url; });

        ai_results.slice(0, 6).forEach((r, i) => {
          const n = i + 1;
          row[`ai_assessment_${n}`] = r?.text || null;
          row[`ai_price_${n}`]      = r?.price ? r.price.replace("Indicative price: ", "") : null;
          row[`ai_confidence_${n}`] = r?.confidence || null;
          row[`ai_service_${n}`]    = r?.service || null;
        });

        const dbRes = await fetch(`${env.SUPABASE_URL}/rest/v1/quote_submissions`, {
          method: "POST",
          headers: {
            Authorization:  `Bearer ${env.SUPABASE_ANON_KEY}`,
            apikey:          env.SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            Prefer:         "return=representation",
          },
          body: JSON.stringify(row),
        });

        if (dbRes.ok) {
          const dbData = await dbRes.json();
          submissionId = dbData[0]?.id || null;

          // ── Auto-allocate technician ──────────────────────────────────────
          if (submissionId && postcode) {
            try {
              await autoAllocateTechnician({
                env,
                submissionId,
                postcode,
                customer_name,
                vehicle_make,
                vehicle_model,
                service_type,
                photo_count: validPhotos.length,
                ai_price: ai_results[0]?.price || null,
              });
            } catch (allocErr) {
              console.error("Auto-allocation error:", allocErr.message);
              // Non-fatal — job still saved, admin can assign manually
            }
          }
        }

      } catch (supaErr) {
        console.error("Supabase error:", supaErr.message);
      }
    }

    return json({ success: true, submissionId }, 200, corsHeaders);

  } catch (error) {
    return json(
      { success: false, error: error.message || "Unknown error" },
      500,
      corsHeaders
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER 2 — Send confirmed quote email to customer
// Called from admin.html when technician has confirmed
// ══════════════════════════════════════════════════════════════════════════════

async function handleConfirmedQuoteEmail(request, env, corsHeaders) {
  try {
    const data = await request.json();

    const {
      customer_name,
      customer_email,
      vehicle_make,
      vehicle_model,
      service_type,
      postcode,
      technician_price,
      technician_availability,
      technician_notes,
      assigned_technician_id,
      booking_token,
    } = data;

    if (!customer_email || !customer_name || !technician_price) {
      return json(
        { success: false, error: "Missing required fields: customer_email, customer_name, technician_price" },
        400,
        corsHeaders
      );
    }

    // Fetch technician's Calendly link from Supabase
    let calendlyLink = "https://calendly.com/gunny8891/30min"; // fallback
    if (assigned_technician_id && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      try {
        const techRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/technicians?id=eq.${assigned_technician_id}&select=calendly_link,name`,
          {
            headers: {
              Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
              apikey: env.SUPABASE_ANON_KEY,
            },
          }
        );
        if (techRes.ok) {
          const techs = await techRes.json();
          if (techs[0]?.calendly_link) {
            calendlyLink = techs[0].calendly_link;
          }
        }
      } catch (e) {
        console.error("Failed to fetch technician Calendly link:", e.message);
      }
    }

    // Build booking URL with customer details pre-filled
    // Customer picks an open slot and pays the deposit on this page
    const bookingUrl = booking_token
      ? `${SITE_URL}/booking.html?t=${encodeURIComponent(booking_token)}`
      : `https://www.scuffiq.com/book.html?name=${encodeURIComponent(customer_name||'')}&vehicle=${encodeURIComponent((vehicle_make||'')+' '+(vehicle_model||''))}&service=${encodeURIComponent(service_type||'')}&price=${encodeURIComponent(technician_price||'')}&calendly=${encodeURIComponent(calendlyLink)}`;

    const firstName = escapeHtml((customer_name || "").split(" ")[0]);
    const price     = escapeHtml(technician_price || "");
    const avail     = escapeHtml(technician_availability || "To be confirmed");
    const notes     = technician_notes ? escapeHtml(technician_notes) : null;

    const confirmedQuoteHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ScuffIQ Quote is Ready</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0 !important; padding: 0 !important; background-color: #0d0d0d; }
    body, td, th, p, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
    a { color: #00d4ff; text-decoration: none; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0d0d0d;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0d0d0d;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#111111;border:1px solid #222222;">

  <!-- HEADER -->
  <tr>
    <td align="center" style="background-color:#0a0a0a;padding:32px 40px 24px;border-bottom:3px solid #00d4ff;">
      <img src="https://scuffiq.com/scuffiq-logo.png" alt="ScuffIQ" width="140" style="display:block;margin:0 auto 14px;width:140px;height:auto;" />
      <p style="margin:0;font-size:11px;color:#888888;letter-spacing:1.5px;text-transform:uppercase;">Smart Repair Specialists</p>
    </td>
  </tr>

  <!-- STATUS BANNER -->
  <tr>
    <td style="padding:24px 36px 0;background-color:#111111;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#001f2b;border:1px solid #003d5c;">
        <tr>
          <td valign="middle" style="padding:16px;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#00d4ff;">&#10003; Your confirmed quote is ready</p>
            <p style="margin:0;font-size:12px;color:#667788;">A ScuffIQ technician has reviewed your photos</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- GREETING -->
  <tr>
    <td style="padding:28px 36px 0;background-color:#111111;">
      <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#ffffff;">Hi ${firstName},</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#aaaaaa;">
        Great news — a ScuffIQ technician has reviewed your damage photos and confirmed a price for your repair. Here are the details:
      </p>
    </td>
  </tr>

  <!-- PRICE HIGHLIGHT -->
  <tr>
    <td style="padding:24px 36px 0;background-color:#111111;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#001a20;border:2px solid #00d4ff;">
        <tr>
          <td align="center" style="padding:28px 20px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#667788;">Your confirmed price</p>
            <p style="margin:0;font-size:42px;font-weight:700;color:#00d4ff;letter-spacing:-1px;">${price}</p>
            <p style="margin:8px 0 0;font-size:12px;color:#667788;">No hidden charges. The price you're quoted is the price you pay.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- QUOTE DETAILS -->
  <tr>
    <td style="padding:20px 36px 0;background-color:#111111;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#181818;border:1px solid #252525;">
        <tr>
          <td colspan="2" style="padding:12px 20px;background-color:#001a20;border-bottom:1px solid #003040;">
            <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00d4ff;">Repair Details</p>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Vehicle</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(vehicle_make || "")} ${escapeHtml(vehicle_model || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Service</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(service_type || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Postcode</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(postcode || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;${notes ? 'border-bottom:1px solid #1e1e1e;' : ''}">Technician availability</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#00d4ff;font-weight:600;text-align:right;${notes ? 'border-bottom:1px solid #1e1e1e;' : ''}">${avail}</td>
        </tr>
        ${notes ? `
        <tr>
          <td colspan="2" style="padding:13px 20px;font-size:13px;color:#aaaaaa;font-style:italic;">"${notes}"</td>
        </tr>` : ''}
      </table>
    </td>
  </tr>

  <!-- BOOK CTA -->
  <tr>
    <td style="padding:28px 36px 0;background-color:#111111;" align="center">
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#aaaaaa;">
        Ready to go ahead? Reply to this email or call us to confirm your booking — we'll come to you at a time that suits.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="background-color:#00d4ff;padding:14px 36px;">
            <a href="${bookingUrl}" style="font-size:15px;font-weight:700;color:#000000;text-decoration:none;display:block;">Book my repair &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:#555555;">Or email us directly: <a href="mailto:hello@scuffiq.com" style="color:#00d4ff;">hello@scuffiq.com</a></p>
    </td>
  </tr>

  <!-- SIGN OFF -->
  <tr>
    <td style="padding:28px 36px 36px;background-color:#111111;">
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#888888;">
        This quote is valid for 30 days. If you have any questions, simply reply to this email.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#888888;">
        Looking forward to getting your car looking flawless,<br />
        <span style="color:#00d4ff;font-weight:700;">The ScuffIQ Team</span>
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:24px 36px;background-color:#0a0a0a;border-top:1px solid #1a1a1a;" align="center">
      <p style="margin:0 0 6px;font-size:12px;color:#444444;">
        ScuffIQ Ltd &middot; North &amp; South London, Hertfordshire &amp; Essex<br />
        <a href="mailto:hello@scuffiq.com" style="color:#00d4ff;">hello@scuffiq.com</a>&nbsp;&middot;&nbsp;
        <a href="https://www.scuffiq.com" style="color:#00d4ff;">scuffiq.com</a>
      </p>
      <p style="margin:0;font-size:11px;color:#333333;">You're receiving this because you submitted a quote request at scuffiq.com.</p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;

    // Send to customer
    await sendResendEmail(env, {
      to: customer_email,
      subject: `Your ScuffIQ repair quote — ${price}`,
      html: confirmedQuoteHtml,
    });

    // Send copy to internal team
    await sendResendEmail(env, {
      to: env.INTERNAL_EMAIL || "hello@scuffiq.com",
      subject: `Quote sent to customer: ${escapeHtml(customer_name)} — ${price}`,
      html: `<p>Confirmed quote email sent to <strong>${escapeHtml(customer_email)}</strong> for <strong>${escapeHtml(vehicle_make||"")} ${escapeHtml(vehicle_model||"")}</strong>.</p><p>Price: <strong>${price}</strong></p><p>Availability: ${avail}</p>${notes ? `<p>Notes: ${notes}</p>` : ''}`,
    });

    return json({ success: true }, 200, corsHeaders);

  } catch (error) {
    return json(
      { success: false, error: error.message || "Unknown error" },
      500,
      corsHeaders
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER 3 — Send job review email to technician
// Called from admin.html when a technician is assigned
// ══════════════════════════════════════════════════════════════════════════════

async function handleTechnicianJobEmail(request, env, corsHeaders) {
  try {
    const data = await request.json();

    const {
      technician_name,
      technician_email,
      customer_name,
      customer_phone,
      vehicle_make,
      vehicle_model,
      service_type,
      postcode,
      photo_count,
      ai_price,
      ai_assessment,
      review_link,
    } = data;

    if (!technician_email || !review_link) {
      return json(
        { success: false, error: "Missing technician_email or review_link" },
        400,
        corsHeaders
      );
    }

    const techFirstName = escapeHtml((technician_name || "Technician").split(" ")[0]);

    const techEmailHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Job — ScuffIQ</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0 !important; padding: 0 !important; background-color: #0d0d0d; }
    body, td, th, p, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
    a { color: #00d4ff; text-decoration: none; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0d0d0d;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0d0d0d;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color:#111111;border:1px solid #222222;">

  <!-- HEADER -->
  <tr>
    <td align="center" style="background-color:#0a0a0a;padding:32px 40px 24px;border-bottom:3px solid #00d4ff;">
      <img src="https://scuffiq.com/scuffiq-logo.png" alt="ScuffIQ" width="140" style="display:block;margin:0 auto 14px;width:140px;height:auto;" />
      <p style="margin:0;font-size:11px;color:#888888;letter-spacing:1.5px;text-transform:uppercase;">Technician Portal</p>
    </td>
  </tr>

  <!-- STATUS BANNER -->
  <tr>
    <td style="padding:24px 36px 0;background-color:#111111;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#001f2b;border:1px solid #003d5c;">
        <tr>
          <td valign="middle" style="padding:16px;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#00d4ff;">&#128295; New job assigned to you</p>
            <p style="margin:0;font-size:12px;color:#667788;">Review the details and confirm your price</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- GREETING -->
  <tr>
    <td style="padding:28px 36px 0;background-color:#111111;">
      <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#ffffff;">Hi ${techFirstName},</p>
      <p style="margin:0;font-size:14px;line-height:1.7;color:#aaaaaa;">
        ScuffIQ has assigned you a new repair job. Please review the details below and confirm your price and availability using the secure link.
      </p>
    </td>
  </tr>

  <!-- JOB DETAILS -->
  <tr>
    <td style="padding:24px 36px 0;background-color:#111111;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#181818;border:1px solid #252525;">
        <tr>
          <td colspan="2" style="padding:12px 20px;background-color:#001a20;border-bottom:1px solid #003040;">
            <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00d4ff;">Job Details</p>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Vehicle</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(vehicle_make || "")} ${escapeHtml(vehicle_model || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Service</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(service_type || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Location</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(postcode || "")}</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;border-bottom:1px solid #1e1e1e;">Photos</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#e0e0e0;font-weight:600;text-align:right;border-bottom:1px solid #1e1e1e;">${escapeHtml(String(photo_count || 0))} uploaded</td>
        </tr>
        <tr>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#666666;${ai_assessment ? 'border-bottom:1px solid #1e1e1e;' : ''}">Indicative estimate</td>
          <td width="50%" style="padding:13px 20px;font-size:13px;color:#00d4ff;font-weight:700;text-align:right;${ai_assessment ? 'border-bottom:1px solid #1e1e1e;' : ''}">${escapeHtml(ai_price || "Review photos")}</td>
        </tr>
        ${ai_assessment ? `
        <tr>
          <td colspan="2" style="padding:13px 20px;font-size:12px;color:#aaaaaa;line-height:1.6;font-style:italic;">
            <span style="display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#00d4ff;margin-bottom:6px;">AI Assessment</span>
            ${escapeHtml(ai_assessment)}
          </td>
        </tr>` : ''}
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="padding:28px 36px 0;background-color:#111111;" align="center">
      <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#aaaaaa;">
        Click the button below to view the damage photos, AI assessment and confirm your price. This link is secure and unique to this job.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="background-color:#00d4ff;padding:16px 40px;">
            <a href="${escapeHtml(review_link)}" style="font-size:15px;font-weight:700;color:#000000;text-decoration:none;display:block;">Review job &amp; confirm price &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#444444;">Or copy this link: <a href="${escapeHtml(review_link)}" style="color:#00d4ff;word-break:break-all;">${escapeHtml(review_link)}</a></p>
    </td>
  </tr>

  <!-- SIGN OFF -->
  <tr>
    <td style="padding:28px 36px 36px;background-color:#111111;">
      <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#888888;">
        If you have any questions about this job, reply to this email or contact ScuffIQ directly.
      </p>
      <p style="margin:0;font-size:14px;color:#888888;">
        Thanks,<br />
        <span style="color:#00d4ff;font-weight:700;">The ScuffIQ Team</span>
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="padding:24px 36px;background-color:#0a0a0a;border-top:1px solid #1a1a1a;" align="center">
      <p style="margin:0 0 6px;font-size:12px;color:#444444;">
        ScuffIQ Ltd &middot; <a href="mailto:hello@scuffiq.com" style="color:#00d4ff;">hello@scuffiq.com</a> &middot; <a href="https://www.scuffiq.com" style="color:#00d4ff;">scuffiq.com</a>
      </p>
      <p style="margin:0;font-size:11px;color:#333333;">This job was assigned to you by ScuffIQ admin.</p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;

    await sendResendEmail(env, {
      to: technician_email,
      subject: `🔧 New job — ${escapeHtml(vehicle_make || "")} ${escapeHtml(vehicle_model || "")} in ${escapeHtml(postcode || "")}${ai_price ? ' · Indicative est. ' + ai_price : ''}`,
      html: techEmailHtml,
    });

    return json({ success: true }, 200, corsHeaders);

  } catch (error) {
    return json(
      { success: false, error: error.message || "Unknown error" },
      500,
      corsHeaders
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTO-ALLOCATION — Match postcode to technician and send job email
// ══════════════════════════════════════════════════════════════════════════════

async function autoAllocateTechnician({ env, submissionId, postcode, customer_name, vehicle_make, vehicle_model, service_type, photo_count, ai_price }) {

  // 1. Extract postcode district (e.g. "EN5 2HS" → "EN5", "SW11 1AB" → "SW11")
  const district = extractPostcodeDistrict(postcode);
  if (!district) {
    console.log("Could not extract postcode district from:", postcode);
    await sendAdminAlert(env, postcode, customer_name, submissionId, "Could not parse postcode district");
    return;
  }

  // 2. Fetch all active technicians
  const techRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/technicians?select=*&active=eq.true&order=name.asc`,
    {
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  if (!techRes.ok) {
    throw new Error("Failed to fetch technicians: " + await techRes.text());
  }

  const technicians = await techRes.json();

  if (!technicians.length) {
    await sendAdminAlert(env, postcode, customer_name, submissionId, "No active technicians found");
    return;
  }

  // 3. Find matching technician by coverage area
  let matched = null;
  for (const tech of technicians) {
    const areas = (tech.Coverage_Area || tech.coverage_areas || tech.coverage_area || "")
      .split(",")
      .map(a => a.trim().toUpperCase());
    if (areas.includes(district.toUpperCase())) {
      matched = tech;
      break;
    }
  }

  if (!matched) {
    console.log(`No technician covers ${district} — sending admin alert`);
    await sendAdminAlert(env, postcode, customer_name, submissionId, `No technician covers ${district}`);
    return;
  }

  // 4. Generate review token
  const token = crypto.randomUUID();
  const reviewLink = `https://scuffiq.com/technician/quote.html?token=${token}`;

  // 5. Update Supabase with technician assignment
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/quote_submissions?id=eq.${submissionId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        apikey: env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        assigned_technician_id:  matched.id,
        technician_name:         matched.name,
        technician_email:        matched.email,
        technician_status:       "sent",
        technician_review_token: token,
        status:                  "sent_to_technician",
      }),
    }
  );

  // 6. Email the technician
  const techEmailRes = await fetch(
    `${env.SUPABASE_URL ? "https://plain-math-71e8scuffiq-api.gunny8891.workers.dev" : ""}/send-technician-job`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        technician_name:  matched.name,
        technician_email: matched.email,
        customer_name,
        customer_phone:   customer_phone || "",
        vehicle_make,
        vehicle_model,
        service_type,
        postcode,
        photo_count,
        ai_price,
        ai_assessment:    ai_results?.[0]?.text || "",
        review_link:      reviewLink,
      }),
    }
  );

  // Direct Resend call as fallback if self-call doesn't work
  if (!techEmailRes.ok) {
    await sendTechnicianJobEmailDirect(env, {
      technician_name:  matched.name,
      technician_email: matched.email,
      customer_name,
      customer_phone:   customer_phone || "",
      vehicle_make,
      vehicle_model,
      service_type,
      postcode,
      photo_count,
      ai_price,
      ai_assessment:    ai_results?.[0]?.text || "",
      review_link:      reviewLink,
    });
  }

  console.log(`Auto-allocated to ${matched.name} (${district})`);
}

function extractPostcodeDistrict(postcode) {
  if (!postcode) return null;
  // Remove all spaces and uppercase
  const clean = postcode.replace(/\s+/g, "").toUpperCase();
  // UK postcode district is everything except the last 3 characters (inward code)
  // e.g. EN52HS → remove 2HS → EN5
  // e.g. SW111AB → remove 1AB → SW11
  // e.g. CR04AB → remove 4AB → CR0
  if (clean.length < 5) return null;
  const district = clean.slice(0, clean.length - 3);
  return district;
}

async function sendAdminAlert(env, postcode, customer_name, submissionId, reason) {
  try {
    await sendResendEmail(env, {
      to: env.INTERNAL_EMAIL || "hello@scuffiq.com",
      subject: `⚠️ Manual assignment needed — ${postcode}`,
      html: `
        <h2>Manual Technician Assignment Required</h2>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Customer:</strong> ${escapeHtml(customer_name)}</p>
        <p><strong>Postcode:</strong> ${escapeHtml(postcode)}</p>
        <p><strong>Job ID:</strong> ${submissionId}</p>
        <p>Please log in to the <a href="https://scuffiq.com/admin.html">ScuffIQ admin dashboard</a> and assign a technician manually.</p>
      `,
    });
  } catch (e) {
    console.error("Failed to send admin alert:", e.message);
  }
}

async function sendTechnicianJobEmailDirect(env, { technician_name, technician_email, customer_name, customer_phone, vehicle_make, vehicle_model, service_type, postcode, photo_count, ai_price, ai_assessment, review_link }) {
  const techFirstName = escapeHtml((technician_name || "Technician").split(" ")[0]);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#fff;padding:32px;">
      <img src="https://scuffiq.com/scuffiq-logo.png" alt="ScuffIQ" style="height:36px;margin-bottom:24px;">
      <h2 style="color:#00d4ff;">New job assigned — ${escapeHtml(vehicle_make||'')} ${escapeHtml(vehicle_model||'')}</h2>
      <p>Hi ${techFirstName}, you have a new ScuffIQ job in <strong>${escapeHtml(postcode||'')}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:10px;color:#888;">Customer</td><td style="padding:10px;color:#fff;font-weight:bold;">${escapeHtml(customer_name||'')}</td></tr>
        <tr><td style="padding:10px;color:#888;">Vehicle</td><td style="padding:10px;color:#fff;font-weight:bold;">${escapeHtml(vehicle_make||'')} ${escapeHtml(vehicle_model||'')}</td></tr>
        <tr><td style="padding:10px;color:#888;">Service</td><td style="padding:10px;color:#fff;font-weight:bold;">${escapeHtml(service_type||'')}</td></tr>
        <tr><td style="padding:10px;color:#888;">Postcode</td><td style="padding:10px;color:#fff;font-weight:bold;">${escapeHtml(postcode||'')}</td></tr>
        <tr><td style="padding:10px;color:#888;">AI estimate</td><td style="padding:10px;color:#00d4ff;font-weight:bold;">${escapeHtml(ai_price||'Review photos')}</td></tr>
      </table>
      <a href="${escapeHtml(review_link)}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:bold;padding:14px 32px;text-decoration:none;font-size:15px;">Review job &amp; confirm price →</a>
    </div>`;

  await sendResendEmail(env, {
    to: technician_email,
    subject: `New ScuffIQ job — ${escapeHtml(vehicle_make||'')} ${escapeHtml(vehicle_model||'')} in ${escapeHtml(postcode||'')}`,
    html,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER — Technician application from /join.html
// ══════════════════════════════════════════════════════════════════════════════

async function handleTechnicianApplication(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { name, email, phone, postcode, services, experience, notes } = data;

    if (!name || !email || !phone) {
      return json({ success: false, error: "Missing required fields" }, 400, corsHeaders);
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#fff;padding:32px;border:1px solid #222;">
        <img src="https://scuffiq.com/scuffiq-logo.png" alt="ScuffIQ" style="height:36px;margin-bottom:24px;">
        <h2 style="color:#00d4ff;margin-bottom:20px;">New Technician Application</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:10px 0;color:#888;width:140px;">Name</td><td style="padding:10px 0;color:#fff;font-weight:600;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:10px 0;color:#888;border-top:1px solid #222;">Email</td><td style="padding:10px 0;color:#00d4ff;border-top:1px solid #222;"><a href="mailto:${escapeHtml(email)}" style="color:#00d4ff;">${escapeHtml(email)}</a></td></tr>
          <tr><td style="padding:10px 0;color:#888;border-top:1px solid #222;">Phone</td><td style="padding:10px 0;color:#fff;font-weight:600;border-top:1px solid #222;">${escapeHtml(phone)}</td></tr>
          <tr><td style="padding:10px 0;color:#888;border-top:1px solid #222;">Area</td><td style="padding:10px 0;color:#fff;border-top:1px solid #222;">${escapeHtml(postcode)}</td></tr>
          <tr><td style="padding:10px 0;color:#888;border-top:1px solid #222;">Services</td><td style="padding:10px 0;color:#fff;border-top:1px solid #222;">${escapeHtml(services)}</td></tr>
          <tr><td style="padding:10px 0;color:#888;border-top:1px solid #222;">Experience</td><td style="padding:10px 0;color:#fff;border-top:1px solid #222;">${escapeHtml(experience)}</td></tr>
          ${notes ? `<tr><td style="padding:10px 0;color:#888;border-top:1px solid #222;vertical-align:top;">Notes</td><td style="padding:10px 0;color:#aaa;border-top:1px solid #222;">${escapeHtml(notes)}</td></tr>` : ''}
        </table>
        <p style="margin-top:24px;font-size:13px;color:#555;">Submitted via scuffiq.com/join.html</p>
      </div>`;

    await sendResendEmail(env, {
      to: env.INTERNAL_EMAIL || "hello@scuffiq.com",
      subject: `🔧 New technician application — ${escapeHtml(name)}, ${escapeHtml(postcode)}`,
      html,
    });

    // Send acknowledgement to applicant
    await sendResendEmail(env, {
      to: email,
      subject: "We've received your ScuffIQ application",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#fff;padding:32px;border:1px solid #222;">
          <img src="https://scuffiq.com/scuffiq-logo.png" alt="ScuffIQ" style="height:36px;margin-bottom:24px;">
          <h2 style="color:#00d4ff;">Application received, ${escapeHtml(name.split(' ')[0])}!</h2>
          <p style="color:#aaa;line-height:1.7;margin:16px 0;">Thanks for applying to join the ScuffIQ technician network. We've received your details and will be in touch within 24 hours.</p>
          <p style="color:#aaa;line-height:1.7;margin:16px 0;">In the meantime, if you have any questions just reply to this email.</p>
          <p style="color:#aaa;margin-top:24px;">The ScuffIQ Team<br><a href="mailto:hello@scuffiq.com" style="color:#00d4ff;">hello@scuffiq.com</a></p>
        </div>`,
    });

    return json({ success: true }, 200, corsHeaders);
  } catch (error) {
    return json({ success: false, error: error.message }, 500, corsHeaders);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// BOOKINGS — customer picks an open slot, pays the deposit through Stripe
//
// Needs these Cloudflare secrets: SUPABASE_SERVICE_KEY, STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET. Customers never touch the database directly.
// ══════════════════════════════════════════════════════════════════════════════

const SITE_URL = "https://scuffiq.com";
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_RE = TOKEN_RE;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Database call with the service role key (bypasses row level security)
async function db(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      apikey: env.SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function quoteForToken(env, token) {
  if (!TOKEN_RE.test(token || "")) return null;
  const rows = await db(
    env,
    `quote_submissions?booking_token=eq.${token}&select=id,customer_name,customer_email,customer_phone,vehicle_make,vehicle_model,service_type,final_quote_given`
  );
  return rows[0] || null;
}

// 20% of the confirmed price, at least £25, at most £75. Returns pence, or null if no price is confirmed.
function depositPenceFor(quote) {
  const price = parseFloat(String(quote.final_quote_given || "").replace(/[^0-9.]/g, ""));
  if (!price || price <= 0) return null;
  const pounds = Math.min(75, Math.max(25, Math.round(price * 0.2)));
  return pounds * 100;
}

function formatSlot(isoDate, period) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
  return `${day}, ${period === "am" ? "morning" : "afternoon"}`;
}

function formatPence(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

async function handleBookingSlots(request, env, corsHeaders) {
  try {
    const { token } = await request.json();
    const quote = await quoteForToken(env, token);
    if (!quote) {
      return json({ success: false, error: "This booking link is not valid." }, 404, corsHeaders);
    }

    const today = new Date().toISOString().slice(0, 10);
    const slots = await db(
      env,
      `booking_slots?status=eq.open&slot_date=gte.${today}&select=id,slot_date,period&order=slot_date.asc,period.asc`
    );

    return json({
      success: true,
      customer_name: quote.customer_name,
      service: quote.service_type,
      vehicle: `${quote.vehicle_make || ""} ${quote.vehicle_model || ""}`.trim(),
      deposit_pence: depositPenceFor(quote),
      slots,
    }, 200, corsHeaders);
  } catch (error) {
    return json({ success: false, error: error.message }, 500, corsHeaders);
  }
}

async function handleBookingCheckout(request, env, corsHeaders) {
  let booking = null;
  let slotId = null;
  try {
    const { token, slot_id, customer_phone } = await request.json();
    slotId = slot_id;

    const quote = await quoteForToken(env, token);
    if (!quote) {
      return json({ success: false, error: "This booking link is not valid." }, 404, corsHeaders);
    }
    if (!UUID_RE.test(slot_id || "")) {
      return json({ success: false, error: "Please choose a slot." }, 400, corsHeaders);
    }

    const deposit = depositPenceFor(quote);
    if (deposit === null) {
      return json({ success: false, error: "The price for this repair isn't confirmed yet. Please reply to our email." }, 400, corsHeaders);
    }

    // Hold the slot only if it is still open. Two customers can't hold the same slot.
    const held = await db(env, `booking_slots?id=eq.${slot_id}&status=eq.open`, {
      method: "PATCH",
      body: JSON.stringify({ status: "held" }),
    });
    if (!held.length) {
      return json({ success: false, error: "That slot has just been taken. Please choose another." }, 409, corsHeaders);
    }
    const slot = held[0];

    [booking] = await db(env, "bookings", {
      method: "POST",
      body: JSON.stringify({
        quote_id: quote.id,
        slot_id,
        status: "pending_payment",
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        customer_phone: customer_phone || quote.customer_phone || null,
        deposit_pence: deposit,
      }),
    });

    const session = await createDepositSession(env, { quote, slot, booking, deposit, token });
    await db(env, `bookings?id=eq.${booking.id}`, {
      method: "PATCH",
      body: JSON.stringify({ stripe_session_id: session.id }),
    });

    return json({ success: true, url: session.url }, 200, corsHeaders);
  } catch (error) {
    console.error("Booking checkout error:", error.message);
    // Put the slot back and cancel the booking if anything failed after holding it
    if (slotId && UUID_RE.test(slotId)) {
      await db(env, `booking_slots?id=eq.${slotId}&status=eq.held`, {
        method: "PATCH",
        body: JSON.stringify({ status: "open" }),
      }).catch(() => {});
    }
    if (booking) {
      await db(env, `bookings?id=eq.${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", cancelled_at: new Date().toISOString() }),
      }).catch(() => {});
    }
    return json({ success: false, error: "We couldn't start the payment. Please try again." }, 500, corsHeaders);
  }
}

async function createDepositSession(env, { quote, slot, booking, deposit, token }) {
  const body = new URLSearchParams({
    mode: "payment",
    customer_email: quote.customer_email,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(deposit),
    "line_items[0][price_data][product_data][name]": `ScuffIQ booking deposit: ${formatSlot(slot.slot_date, slot.period)}`,
    success_url: `${SITE_URL}/booking.html?t=${token}&paid=1`,
    cancel_url: `${SITE_URL}/booking.html?t=${token}&cancelled=1`,
    "metadata[booking_id]": booking.id,
    "payment_intent_data[metadata][booking_id]": booking.id,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return res.json();
}

async function handleBookingRequest(request, env, corsHeaders) {
  try {
    const { token, requested_date, period, note } = await request.json();
    const quote = await quoteForToken(env, token);
    if (!quote) {
      return json({ success: false, error: "This booking link is not valid." }, 404, corsHeaders);
    }
    if (!DATE_RE.test(requested_date || "")) {
      return json({ success: false, error: "Please choose a date." }, 400, corsHeaders);
    }
    const cleanPeriod = period === "am" || period === "pm" ? period : null;
    const cleanNote = note ? String(note).slice(0, 500) : null;

    await db(env, "booking_requests", {
      method: "POST",
      body: JSON.stringify({
        quote_id: quote.id,
        requested_date,
        period: cleanPeriod,
        note: cleanNote,
      }),
    });

    const when = cleanPeriod
      ? formatSlot(requested_date, cleanPeriod)
      : `${formatSlot(requested_date, "am").replace(/, morning$/, "")} (any time)`;

    await sendResendEmail(env, {
      to: env.INTERNAL_EMAIL || "hello@scuffiq.com",
      subject: `Date request: ${escapeHtml(quote.customer_name)}, ${escapeHtml(when)}`,
      html: `<p><strong>${escapeHtml(quote.customer_name)}</strong> (${escapeHtml(quote.customer_email)}) asked for <strong>${escapeHtml(when)}</strong>.</p>
             ${cleanNote ? `<p>Note: ${escapeHtml(cleanNote)}</p>` : ""}
             <p>No payment has been taken. Confirm the date with the technician, then send the payment link.</p>`,
    });

    await sendResendEmail(env, {
      to: quote.customer_email,
      subject: "We've received your preferred date",
      html: `<p>Hi ${escapeHtml((quote.customer_name || "").split(" ")[0])},</p>
             <p>Thanks for asking for ${escapeHtml(when)}. We'll check it with your technician and confirm by email. No payment is needed until your date is confirmed.</p>
             <p>ScuffIQ<br><a href="mailto:hello@scuffiq.com">hello@scuffiq.com</a></p>`,
    });

    return json({ success: true }, 200, corsHeaders);
  } catch (error) {
    console.error("Booking request error:", error.message);
    return json({ success: false, error: "We couldn't send your request. Please try again." }, 500, corsHeaders);
  }
}

async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  const session = event.data && event.data.object;
  const bookingId = session && session.metadata && session.metadata.booking_id;

  try {
    if (event.type === "checkout.session.completed" && session.payment_status === "paid" && bookingId) {
      // Only move a booking forward once, even if Stripe sends the event twice
      const [booking] = await db(env, `bookings?id=eq.${bookingId}&status=eq.pending_payment`, {
        method: "PATCH",
        body: JSON.stringify({ status: "paid", stripe_payment_id: session.payment_intent }),
      });
      if (booking) {
        await db(env, `booking_slots?id=eq.${booking.slot_id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "booked" }),
        });
        await sendBookingEmails(env, booking);
      }
    }

    if (event.type === "checkout.session.expired" && bookingId) {
      const [booking] = await db(env, `bookings?id=eq.${bookingId}&status=eq.pending_payment`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", cancelled_at: new Date().toISOString() }),
      });
      if (booking) {
        await db(env, `booking_slots?id=eq.${booking.slot_id}&status=eq.held`, {
          method: "PATCH",
          body: JSON.stringify({ status: "open" }),
        });
      }
    }
  } catch (error) {
    console.error("Webhook handling error:", error.message);
    return new Response("Processing error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

async function sendBookingEmails(env, booking) {
  const [slot] = await db(env, `booking_slots?id=eq.${booking.slot_id}&select=slot_date,period`);
  const when = formatSlot(slot.slot_date, slot.period);
  const deposit = formatPence(booking.deposit_pence);
  const firstName = escapeHtml((booking.customer_name || "").split(" ")[0]);

  await sendResendEmail(env, {
    to: booking.customer_email,
    subject: `Your ScuffIQ booking is confirmed: ${when}`,
    html: `<p>Hi ${firstName},</p>
           <p>Your appointment is booked for <strong>${escapeHtml(when)}</strong>.</p>
           <p>We've taken your deposit of <strong>${deposit}</strong>. The balance is due when the repair is complete, and the deposit comes off your final bill.</p>
           <p>Need to change it? Cancel or reschedule free of charge with at least 48 hours' notice. Less notice may mean the deposit is kept. Reply to this email to get in touch.</p>
           <p>ScuffIQ<br><a href="mailto:hello@scuffiq.com">hello@scuffiq.com</a></p>`,
  });

  await sendResendEmail(env, {
    to: env.INTERNAL_EMAIL || "hello@scuffiq.com",
    subject: `Booked and paid: ${escapeHtml(booking.customer_name)}, ${when}`,
    html: `<p><strong>${escapeHtml(booking.customer_name)}</strong> (${escapeHtml(booking.customer_email)}${booking.customer_phone ? ", " + escapeHtml(booking.customer_phone) : ""}) booked <strong>${escapeHtml(when)}</strong>.</p>
           <p>Deposit paid: ${deposit}</p>`,
  });
}

// Checks the Stripe-Signature header using HMAC-SHA256 and the webhook signing secret
async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(",");
  const t = (parts.find((p) => p.startsWith("t=")) || "").slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendResendEmail(env, { to, subject, html, attachments = [] }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || "ScuffIQ Quotes <quotes@scuffiq.com>",
      to,
      subject,
      html,
      attachments,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${text}`);
  }

  return response.json();
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
