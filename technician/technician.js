// ============================================================
// ScuffIQ Technician Portal
// technician/technician.js
// ============================================================

const SUPABASE_URL = "https://scohjgsjjxbkpfuhlmrz.supabase.co";

// Supabase publishable / anon key
const SUPABASE_KEY = "sb_publishable_ja-1cvEG-6iOG8IO54UfeA_p5ngEFUe";

let currentQuote = null;


// ============================================================
// HELPERS
// ============================================================

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}


async function supaFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();

    console.error(
      "Supabase error:",
      response.status,
      response.statusText,
      text
    );

    throw new Error(
      text || `Supabase request failed (${response.status})`
    );
  }

  if (response.status === 204) {
    return [];
  }

  const text = await response.text();

  if (!text) {
    return [];
  }

  return JSON.parse(text);
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatValue(value, fallback = "—") {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return String(value).trim();
}


function setText(id, value, fallback = "—") {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = formatValue(value, fallback);
  }
}


function getInputValue(id) {
  const element = document.getElementById(id);

  if (!element) {
    return "";
  }

  return String(element.value || "").trim();
}


// ============================================================
// PHOTOS
// ============================================================

function getPhotoUrls(quote) {
  const possibleFields = [
    quote.image_url_1,
    quote.image_url_2,
    quote.image_url_3,
    quote.image_url_4,
    quote.image_url_5,
    quote.image_url_6,

    quote.photo_url_1,
    quote.photo_url_2,
    quote.photo_url_3,
    quote.photo_url_4,
    quote.photo_url_5,
    quote.photo_url_6,
  ];

  return possibleFields.filter(Boolean);
}


function renderPhotos(quote) {
  const photoGrid = document.getElementById("photoGrid");

  if (!photoGrid) {
    return;
  }

  const photoUrls = getPhotoUrls(quote);

  const photoCount = document.getElementById("photoCount");

  if (photoCount) {
    photoCount.textContent =
      `${photoUrls.length} photo${photoUrls.length === 1 ? "" : "s"}`;
  }

  if (!photoUrls.length) {
    photoGrid.innerHTML =
      `<div class="empty-card">
        No damage photos found for this job.
      </div>`;

    return;
  }

  photoGrid.innerHTML = "";

  photoUrls.forEach((url, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "photo-card";

    const image = document.createElement("img");

    image.src = url;
    image.alt = `Damage photo ${index + 1}`;
    image.loading = "lazy";

    const label = document.createElement("span");

    label.textContent = `Photo ${index + 1}`;

    button.appendChild(image);
    button.appendChild(label);

    button.addEventListener("click", function () {
      window.open(url, "_blank", "noopener,noreferrer");
    });

    photoGrid.appendChild(button);
  });
}


// ============================================================
// AI ESTIMATE
// ============================================================

function getAiPrice(quote) {
  return (
    quote.ai_price_1 ||
    quote.ai_price ||
    quote.ai_estimate ||
    quote.estimated_price ||
    quote.final_quote_given ||
    "Technician review required"
  );
}


// ============================================================
// TECHNICIAN AVAILABILITY
// ============================================================

function formatAvailabilityDate(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}


function renderAvailabilityOptions() {
  const container = document.getElementById("availabilityOptions");

  if (!container) {
    console.warn(
      "availabilityOptions element not found in quote.html"
    );

    return;
  }

  container.innerHTML = "";

  const today = new Date();

  today.setHours(12, 0, 0, 0);

  // Generate 14 days
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);

    date.setDate(today.getDate() + i);

    const displayDate = formatAvailabilityDate(date);

    // AM
    createAvailabilityOption(
      container,
      `${displayDate} AM`,
      i,
      "AM"
    );

    // PM
    createAvailabilityOption(
      container,
      `${displayDate} PM`,
      i,
      "PM"
    );
  }

  // Other option
  createAvailabilityOption(
    container,
    "Other — see notes",
    "other",
    "OTHER"
  );
}


function createAvailabilityOption(
  container,
  labelText,
  dayIndex,
  period
) {
  const label = document.createElement("label");

  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "10px";
  label.style.cursor = "pointer";
  label.style.padding = "8px 10px";
  label.style.borderRadius = "6px";
  label.style.background = "#111";

  const checkbox = document.createElement("input");

  checkbox.type = "checkbox";
  checkbox.name = "technicianAvailability";
  checkbox.value = labelText;

  checkbox.dataset.day = String(dayIndex);
  checkbox.dataset.period = period;

  const text = document.createElement("span");

  text.textContent = labelText;

  label.appendChild(checkbox);
  label.appendChild(text);

  container.appendChild(label);
}


function getAvailability() {
  const selected = document.querySelectorAll(
    '#availabilityOptions input[type="checkbox"]:checked'
  );

  const values = Array.from(selected).map(
    checkbox => checkbox.value
  );

  const availability = values.join(", ");

  // Keep hidden input synced if present
  const hidden = document.getElementById("availability");

  if (hidden) {
    hidden.value = availability;
  }

  return availability;
}


// ============================================================
// PAGE STATES
// ============================================================

function showError(message) {
  const loadingEl =
    document.getElementById("loadingState");

  const errorEl =
    document.getElementById("errorState");

  const errorMessage =
    document.getElementById("errorMessage");

  const jobContent =
    document.getElementById("jobContent");

  const successState =
    document.getElementById("successState");


  if (loadingEl) {
    loadingEl.style.display = "none";
  }

  if (jobContent) {
    jobContent.classList.add("hidden");
  }

  if (successState) {
    successState.classList.add("hidden");
  }

  if (errorEl) {
    errorEl.classList.remove("hidden");
  }

  if (errorMessage) {
    errorMessage.textContent = message;
  }
}


function showSuccess(message) {
  const loadingEl =
    document.getElementById("loadingState");

  const errorEl =
    document.getElementById("errorState");

  const jobContent =
    document.getElementById("jobContent");

  const successState =
    document.getElementById("successState");


  if (loadingEl) {
    loadingEl.style.display = "none";
  }

  if (errorEl) {
    errorEl.classList.add("hidden");
  }

  if (jobContent) {
    jobContent.classList.add("hidden");
  }

  if (successState) {
    successState.classList.remove("hidden");
  }


  // Update success message if element exists
  const successText =
    document.getElementById("successText");

  if (successText) {
    successText.textContent = message;
  } else if (successState) {
    const paragraphs =
      successState.querySelectorAll("p");

    if (paragraphs.length) {
      paragraphs[0].textContent = message;
    }
  }
}


// ============================================================
// LOAD JOB
// ============================================================

async function loadTechnicianQuote() {
  const token = getTokenFromUrl();

  const loadingEl =
    document.getElementById("loadingState");

  const errorEl =
    document.getElementById("errorState");

  const jobContent =
    document.getElementById("jobContent");


  if (loadingEl) {
    loadingEl.style.display = "block";
  }

  if (errorEl) {
    errorEl.classList.add("hidden");
  }

  if (jobContent) {
    jobContent.classList.add("hidden");
  }


  if (!token) {
    showError(
      "Invalid review link. No technician review token was found."
    );

    return;
  }


  try {
    console.log(
      "Loading ScuffIQ technician job..."
    );

    const rows = await supaFetch(
      `quote_submissions?select=*&technician_review_token=eq.${encodeURIComponent(token)}&limit=1`
    );


    if (!Array.isArray(rows) || rows.length === 0) {
      showError(
        "This job could not be found. The review link may be invalid or expired."
      );

      return;
    }


    currentQuote = rows[0];

    console.log(
      "Technician job loaded:",
      currentQuote.id
    );


    renderQuote(currentQuote);


    if (loadingEl) {
      loadingEl.style.display = "none";
    }

    if (jobContent) {
      jobContent.classList.remove("hidden");
    }

  } catch (error) {

    console.error(
      "Load quote error:",
      error
    );

    showError(
      "Unable to load this job. Please contact ScuffIQ."
    );
  }
}


// ============================================================
// RENDER JOB
// ============================================================

function renderQuote(quote) {

  // ----------------------------------------------------------
  // IMPORTANT:
  // Do NOT display customer name/email/phone to technician.
  // ----------------------------------------------------------

  setText(
    "postcode",
    quote.postcode
  );


  const vehicle =
    [
      quote.vehicle_make,
      quote.vehicle_model
    ]
      .filter(Boolean)
      .join(" ")
      .trim();


  setText(
    "vehicle",
    vehicle || "Vehicle details unavailable"
  );


  setText(
    "serviceType",
    quote.service_type ||
    quote.service ||
    "Repair"
  );


  // ----------------------------------------------------------
  // Job title
  // ----------------------------------------------------------

  const jobTitle =
    document.getElementById("jobTitle");

  if (jobTitle) {

    const vehicleTitle =
      vehicle || "Vehicle repair";

    jobTitle.textContent =
      `${vehicleTitle} — ${formatValue(
        quote.postcode,
        "ScuffIQ job"
      )}`;
  }


  // ----------------------------------------------------------
  // AI PRICE
  // ----------------------------------------------------------

  const aiPrice =
    document.getElementById("aiPrice");

  if (aiPrice) {
    aiPrice.textContent =
      getAiPrice(quote);
  }


  // ----------------------------------------------------------
  // AI ASSESSMENT
  // ----------------------------------------------------------

  const aiAssessment =
    document.getElementById("aiAssessment");

  if (aiAssessment) {

    const assessment =
      quote.ai_assessment_1 ||
      quote.ai_assessment ||
      quote.damage_assessment;

    aiAssessment.textContent =
      assessment ||
      "Please review the damage photos and confirm your repair price.";
  }


  // ----------------------------------------------------------
  // AI CONFIDENCE
  // ----------------------------------------------------------

  const aiConfidence =
    document.getElementById("aiConfidence");

  if (aiConfidence) {

    const confidence =
      quote.ai_confidence_1 ||
      quote.ai_confidence;

    aiConfidence.textContent =
      confidence
        ? `Confidence: ${confidence}`
        : "Confidence: —";
  }


  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  const status =
    document.getElementById("jobStatus");

  if (status) {

    const statusValue =
      quote.status ||
      "sent_to_technician";

    status.textContent =
      statusValue
        .replace(/_/g, " ")
        .replace(/\b\w/g, char =>
          char.toUpperCase()
        );
  }


  // ----------------------------------------------------------
  // PHOTOS
  // ----------------------------------------------------------

  renderPhotos(quote);


  // ----------------------------------------------------------
  // AVAILABILITY
  // ----------------------------------------------------------

  renderAvailabilityOptions();


  // ----------------------------------------------------------
  // PRICE PLACEHOLDER
  // ----------------------------------------------------------

  const priceInput =
    document.getElementById("technicianPrice");

  if (priceInput) {

    const estimatedPrice =
      getAiPrice(quote);

    if (
      estimatedPrice &&
      estimatedPrice !==
        "Technician review required"
    ) {

      priceInput.placeholder =
        `e.g. ${estimatedPrice}`;
    }
  }
}


// ============================================================
// SUBMIT TECHNICIAN REVIEW
// ============================================================

async function submitTechnicianQuote() {

  if (!currentQuote) {
    alert(
      "No job is currently loaded."
    );

    return;
  }


  const price =
    getInputValue("technicianPrice");

  const availability =
    getAvailability();

  const repairTime =
    getInputValue("repairTime");

  const notes =
    getInputValue("notes");

  const decision =
    getInputValue("decision") ||
    "accepted";


  // ----------------------------------------------------------
  // DECLINE
  // ----------------------------------------------------------

  if (decision === "declined") {

    await declineJob();

    return;
  }


  // ----------------------------------------------------------
  // MORE INFO
  // ----------------------------------------------------------

  if (decision === "more_info") {

    if (!notes) {
      alert(
        "Please explain what additional photos or information you need."
      );

      return;
    }

    await requestMoreInformation(
      notes
    );

    return;
  }


  // ----------------------------------------------------------
  // ACCEPT
  // ----------------------------------------------------------

  if (!price) {

    alert(
      "Please enter your confirmed price."
    );

    return;
  }


  if (!availability) {

    alert(
      "Please select at least one AM or PM availability slot."
    );

    return;
  }


  const submitButton =
    document.getElementById("submitBtn");


  if (submitButton) {

    submitButton.disabled = true;

    submitButton.textContent =
      "Submitting...";
  }


  const payload = {

    technician_price: price,

    technician_availability:
      availability,

    technician_notes:
      notes || null,

    technician_status:
      "confirmed",

    status:
      "technician_confirmed",

    final_quote_given:
      price,

    actual_job_cost:
      price
  };


  /*
    Only include technician_repair_time if your Supabase
    table actually has this column.

    We intentionally don't send it automatically because
    an unknown column would cause the entire PATCH to fail.
  */


  try {

    const result = await supaFetch(
      `quote_submissions?id=eq.${encodeURIComponent(
        currentQuote.id
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      }
    );


    console.log(
      "Technician quote submitted:",
      result
    );


    showSuccess(
      "Quote confirmed. ScuffIQ will review your price and availability before contacting the customer."
    );


  } catch (error) {

    console.error(
      "Submit quote error:",
      error
    );


    alert(
      "Your quote could not be submitted. Please contact ScuffIQ."
    );


  } finally {

    if (submitButton) {

      submitButton.disabled = false;

      submitButton.textContent =
        "Submit review";
    }
  }
}


// ============================================================
// REQUEST MORE INFORMATION
// ============================================================

async function requestMoreInformation(notes) {

  if (!currentQuote) {
    return;
  }


  const submitButton =
    document.getElementById("submitBtn");


  if (submitButton) {

    submitButton.disabled = true;

    submitButton.textContent =
      "Submitting...";
  }


  try {

    await supaFetch(
      `quote_submissions?id=eq.${encodeURIComponent(
        currentQuote.id
      )}`,
      {
        method: "PATCH",

        body: JSON.stringify({

          technician_status:
            "more_info_requested",

          status:
            "technician_more_info",

          technician_notes:
            notes
        })
      }
    );


    showSuccess(
      "Your request has been sent. ScuffIQ will obtain the additional information or photos."
    );


  } catch (error) {

    console.error(
      "More information request error:",
      error
    );


    alert(
      "Could not send your request. Please contact ScuffIQ."
    );


  } finally {

    if (submitButton) {

      submitButton.disabled = false;

      submitButton.textContent =
        "Submit review";
    }
  }
}


// ============================================================
// DECLINE JOB
// ============================================================

async function declineJob() {

  if (!currentQuote) {

    alert(
      "No job is currently loaded."
    );

    return;
  }


  const confirmed = window.confirm(
    "Are you sure you want to decline this job? ScuffIQ will need to assign it to another technician."
  );


  if (!confirmed) {
    return;
  }


  const notes =
    getInputValue("notes");


  const submitButton =
    document.getElementById("submitBtn");


  if (submitButton) {

    submitButton.disabled = true;

    submitButton.textContent =
      "Submitting...";
  }


  try {

    await supaFetch(
      `quote_submissions?id=eq.${encodeURIComponent(
        currentQuote.id
      )}`,
      {
        method: "PATCH",

        body: JSON.stringify({

          technician_status:
            "declined",

          status:
            "technician_declined",

          technician_notes:
            notes ||
            "Technician declined job"
        })
      }
    );


    showSuccess(
      "Job declined. ScuffIQ will assign the repair to another technician."
    );


  } catch (error) {

    console.error(
      "Decline job error:",
      error
    );


    alert(
      "Could not decline the job. Please contact ScuffIQ."
    );


  } finally {

    if (submitButton) {

      submitButton.disabled = false;

      submitButton.textContent =
        "Submit review";
    }
  }
}


// ============================================================
// DECISION FIELD BEHAVIOUR
// ============================================================

function setupDecisionField() {

  const decision =
    document.getElementById("decision");

  const price =
    document.getElementById("technicianPrice");

  const availability =
    document.getElementById("availabilityOptions");


  if (!decision) {
    return;
  }


  function updateForm() {

    const value =
      decision.value;


    if (value === "declined") {

      if (price) {
        price.required = false;
      }

      return;
    }


    if (value === "more_info") {

      if (price) {
        price.required = false;
      }

      return;
    }


    if (price) {
      price.required = true;
    }
  }


  decision.addEventListener(
    "change",
    updateForm
  );


  updateForm();
}


// ============================================================
// START
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  function () {

    console.log(
      "ScuffIQ Technician Portal loaded"
    );


    setupDecisionField();


    const reviewForm =
      document.getElementById("reviewForm");


    if (reviewForm) {

      reviewForm.addEventListener(
        "submit",
        function (event) {

          event.preventDefault();

          submitTechnicianQuote();
        }
      );
    }


    loadTechnicianQuote();
  }
);
