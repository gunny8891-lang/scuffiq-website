// ScuffIQ Technician Portal
// Handles technician quote review links and quote confirmation

const SUPABASE_URL = "https://scohjgsjjxbkpfuhlmrz.supabase.co";

// Replace this with the same anon key used in admin.html
const SUPABASE_KEY = "sb_publishable_ja-1cvEG-6iOG8IO54UfeA_p5ngEFUe";

let currentQuote = null;

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

async function supaFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Supabase request failed");
  }

  return res.json();
}

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatValue(value, fallback = "—") {
  return value && String(value).trim() ? value : fallback;
}

function getPhotoUrls(quote) {
  return [
    quote.image_url_1,
    quote.image_url_2,
    quote.image_url_3,
    quote.image_url_4,
    quote.image_url_5,
    quote.image_url_6,
  ].filter(Boolean);
}

function getAiPrice(quote) {
  return (
    quote.ai_price_1 ||
    quote.ai_price ||
    quote.final_quote_given ||
    "Technician review required"
  );
}async function loadTechnicianQuote() {
  const token = getTokenFromUrl();

  const loadingEl = document.getElementById("loadingState");
  const errorEl = document.getElementById("errorState");
  const appEl = document.getElementById("quoteApp");

  if (loadingEl) loadingEl.style.display = "block";
  if (errorEl) errorEl.style.display = "none";
  if (appEl) appEl.style.display = "none";

  if (!token) {
    showError("Invalid review link. No token was found.");
    return;
  }

  try {
    const rows = await supaFetch(
      `quote_submissions?select=*&technician_review_token=eq.${encodeURIComponent(token)}&limit=1`
    );

    if (!rows || !rows.length) {
      showError("This job could not be found. The link may be invalid or expired.");
      return;
    }

    currentQuote = rows[0];
    renderQuote(currentQuote);

    if (loadingEl) loadingEl.style.display = "none";
    if (appEl) appEl.style.display = "block";
  } catch (error) {
    console.error("Load quote error:", error);
    showError("Unable to load this job. Please contact ScuffIQ.");
  }
}

function showError(message) {
  const loadingEl = document.getElementById("loadingState");
  const errorEl = document.getElementById("errorState");
  const errorTextEl = document.getElementById("errorText");
  const appEl = document.getElementById("quoteApp");

  if (loadingEl) loadingEl.style.display = "none";
  if (appEl) appEl.style.display = "none";

  if (errorEl) {
    errorEl.style.display = "block";
  }

  if (errorTextEl) {
    errorTextEl.textContent = message;
  }
}

function renderQuote(quote) {
  setText("customerName", quote.customer_name);
  setText("customerEmail", quote.customer_email);
  setText("customerPhone", quote.customer_phone);
  setText("postcode", quote.postcode);
  setText("vehicle", `${formatValue(quote.vehicle_make, "")} ${formatValue(quote.vehicle_model, "")}`.trim());
  setText("serviceType", quote.service_type);
  setText("aiPrice", getAiPrice(quote));

  renderPhotos(quote);
  renderAiAssessments(quote);

  const statusEl = document.getElementById("jobStatus");
  if (statusEl) {
    statusEl.textContent = quote.status || "sent_to_technician";
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = formatValue(value);
  }
}function renderPhotos(quote) {
  const photoGrid = document.getElementById("photoGrid");
  if (!photoGrid) return;

  const photoUrls = getPhotoUrls(quote);

  if (!photoUrls.length) {
    photoGrid.innerHTML = `
      <div class="empty-card">
        No damage photos found for this job.
      </div>
    `;
    return;
  }

  photoGrid.innerHTML = photoUrls
    .map((url, index) => {
      return `
        <button class="photo-card" type="button" onclick="openPhoto('${esc(url)}')">
          <img src="${esc(url)}" alt="Damage photo ${index + 1}">
          <span>Photo ${index + 1}</span>
        </button>
      `;
    })
    .join("");
}

function openPhoto(url) {
  window.open(url, "_blank");
}

function renderAiAssessments(quote) {
  const aiWrap = document.getElementById("aiAssessments");
  if (!aiWrap) return;

  const items = [1, 2, 3, 4, 5, 6]
    .map((i) => ({
      assessment: quote[`ai_assessment_${i}`],
      price: quote[`ai_price_${i}`],
      confidence: quote[`ai_confidence_${i}`],
      service: quote[`ai_service_${i}`],
    }))
    .filter((item) => item.assessment || item.price || item.confidence || item.service);

  if (!items.length) {
    aiWrap.innerHTML = `
      <div class="empty-card">
        No AI assessment data found. Review photos manually.
      </div>
    `;
    return;
  }

  aiWrap.innerHTML = items
    .map((item, index) => {
      return `
        <div class="ai-card">
          <div class="ai-card-header">
            <strong>Photo ${index + 1}</strong>
            <span>${esc(item.confidence || "pending")}</span>
          </div>
          <p>${esc(item.assessment || "No assessment available")}</p>
          <div class="ai-card-footer">
            <span>${esc(item.service || "Service pending")}</span>
            <strong>${esc(item.price || "Price pending")}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}async function submitTechnicianQuote() {
  if (!currentQuote) {
    alert("No job loaded.");
    return;
  }

  const price = getInputValue("technicianPrice");
  const availability = getInputValue("technicianAvailability");
  const repairTime = getInputValue("repairTime");
  const notes = getInputValue("technicianNotes");

  if (!price) {
    alert("Please enter your confirmed price.");
    return;
  }

  if (!availability) {
    alert("Please select your availability.");
    return;
  }

  const submitBtn = document.getElementById("submitQuoteBtn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
  }

  const payload = {
    technician_price: price,
    technician_availability: availability,
    technician_notes: notes,
    technician_status: "confirmed",
    status: "technician_confirmed",
    final_quote_given: price,
    actual_job_cost: price,
  };

  if (repairTime) {
    payload.estimated_repair_time = repairTime;
  }

  try {
    await supaFetch(`quote_submissions?id=eq.${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    showSuccess(
      "Quote confirmed successfully. ScuffIQ will now review and contact the customer."
    );
  } catch (error) {
    console.error("Submit quote error:", error);
    alert("Could not submit quote. Please contact ScuffIQ.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Quote";
    }
  }
}

async function declineJob() {
  if (!currentQuote) {
    alert("No job loaded.");
    return;
  }

  const confirmed = confirm(
    "Are you sure you want to decline this job? ScuffIQ will need to assign it to another technician."
  );

  if (!confirmed) return;

  const notes = getInputValue("technicianNotes");

  try {
    await supaFetch(`quote_submissions?id=eq.${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        technician_status: "declined",
        status: "technician_declined",
        technician_notes: notes || "Technician declined job",
      }),
    });

    showSuccess("Job declined. ScuffIQ will reassign this repair.");
  } catch (error) {
    console.error("Decline job error:", error);
    alert("Could not decline job. Please contact ScuffIQ.");
  }
}function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function showSuccess(message) {
  const appEl = document.getElementById("quoteApp");
  const successEl = document.getElementById("successState");
  const successTextEl = document.getElementById("successText");

  if (appEl) appEl.style.display = "none";

  if (successEl) {
    successEl.style.display = "block";
  }

  if (successTextEl) {
    successTextEl.textContent = message;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  loadTechnicianQuote();

  const submitBtn = document.getElementById("submitQuoteBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitTechnicianQuote);
  }

  const declineBtn = document.getElementById("declineJobBtn");
  if (declineBtn) {
    declineBtn.addEventListener("click", declineJob);
  }
});
