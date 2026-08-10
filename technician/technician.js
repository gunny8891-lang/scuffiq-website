// ============================================================
// ScuffIQ Technician Portal
// technician/technician.js
// ============================================================

const SUPABASE_URL = "https://scohjgsjjxbkpfuhlmrz.supabase.co";

// Paste your Supabase ANON / PUBLISHABLE key between the quotes
"sb_publishable_ja-1cvEG-6iOG8IO54UfeA_p5ngEFUe";

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
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase request failed");
  }

  const text = await response.text();

  if (!text) {
    return [];
  }

  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
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
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}


function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = formatValue(value);
  }
}


function getInputValue(id) {
  const element = document.getElementById(id);

  return element ? element.value.trim() : "";
}


function getPhotoUrls(quote) {
  return [
    quote.image_url_1,
    quote.image_url_2,
    quote.image_url_3,
    quote.image_url_4,
    quote.image_url_5,
    quote.image_url_6
  ].filter(Boolean);
}


function getAiPrice(quote) {
  return (
    quote.ai_price_1 ||
    quote.ai_price ||
    quote.final_quote_given ||
    "Technician review required"
  );
}


// ============================================================
// AVAILABILITY — NEXT 14 DAYS WITH AM / PM
// ============================================================

function populateAvailabilityOptions() {
  const container = document.getElementById("availabilityOptions");

  if (!container) {
    console.warn("availabilityOptions not found");
    return;
  }

  container.innerHTML = "";

  const today = new Date();

  for (let i = 0; i < 14; i++) {

    const date = new Date(today);

    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() + i);

    const dayName = date.toLocaleDateString("en-GB", {
      weekday: "short"
    });

    const dateText = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short"
    });

    const fullDate = `${dayName} ${dateText}`;

    const row = document.createElement("div");

    row.style.display = "grid";
    row.style.gridTemplateColumns = "minmax(100px, 1fr) auto auto";
    row.style.alignItems = "center";
    row.style.gap = "14px";
    row.style.padding = "10px 8px";
    row.style.borderBottom =
      "1px solid rgba(255,255,255,0.08)";

    const dateLabel = document.createElement("strong");

    dateLabel.textContent = fullDate;
    dateLabel.style.fontSize = "13px";

    const amLabel = createAvailabilityCheckbox(
      `${fullDate} AM`,
      "AM"
    );

    const pmLabel = createAvailabilityCheckbox(
      `${fullDate} PM`,
      "PM"
    );

    row.appendChild(dateLabel);
    row.appendChild(amLabel);
    row.appendChild(pmLabel);

    container.appendChild(row);
  }


  // Other availability option

  const otherRow = document.createElement("div");

  otherRow.style.padding = "12px 8px 4px";

  const otherLabel = createAvailabilityCheckbox(
    "Other - see notes",
    "Other — see notes"
  );

  otherRow.appendChild(otherLabel);

  container.appendChild(otherRow);
}


function createAvailabilityCheckbox(value, labelText) {

  const label = document.createElement("label");

  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "7px";
  label.style.cursor = "pointer";
  label.style.fontSize = "13px";
  label.style.whiteSpace = "nowrap";


  const checkbox = document.createElement("input");

  checkbox.type = "checkbox";
  checkbox.value = value;

  checkbox.style.width = "17px";
  checkbox.style.height = "17px";
  checkbox.style.cursor = "pointer";


  const text = document.createElement("span");

  text.textContent = labelText;


  label.appendChild(checkbox);
  label.appendChild(text);

  return label;
}


function getAvailability() {

  const selected = document.querySelectorAll(
    '#availabilityOptions input[type="checkbox"]:checked'
  );

  if (selected.length > 0) {

    return Array.from(selected)
      .map(item => item.value)
      .join(", ");
  }


  const hidden =
    document.getElementById("availability");

  return hidden
    ? hidden.value.trim()
    : "";
}


// ============================================================
// LOAD TECHNICIAN JOB
// ============================================================

async function loadTechnicianQuote() {

  const token = getTokenFromUrl();

  const loadingEl =
    document.getElementById("loadingState");

  const errorEl =
    document.getElementById("errorState");

  const appEl =
    document.getElementById("jobContent");


  if (loadingEl) {
    loadingEl.style.display = "block";
  }

  if (errorEl) {
    errorEl.classList.add("hidden");
  }

  if (appEl) {
    appEl.classList.add("hidden");
  }


  if (!token) {

    showError(
      "Invalid review link. No token was found."
    );

    return;
  }


  try {

    const rows = await supaFetch(
      `quote_submissions?select=*&technician_review_token=eq.${encodeURIComponent(token)}&limit=1`
    );


    if (!rows || !rows.length) {

      showError(
        "This job could not be found. The link may be invalid or expired."
      );

      return;
    }


    currentQuote = rows[0];

    renderQuote(currentQuote);


    if (loadingEl) {
      loadingEl.style.display = "none";
    }

    if (appEl) {
      appEl.classList.remove("hidden");
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
// ERROR
// ============================================================

function showError(message) {

  const loadingEl =
    document.getElementById("loadingState");

  const errorEl =
    document.getElementById("errorState");

  const errorMessage =
    document.getElementById("errorMessage");

  const appEl =
    document.getElementById("jobContent");


  if (loadingEl) {
    loadingEl.style.display = "none";
  }

  if (appEl) {
    appEl.classList.add("hidden");
  }

  if (errorEl) {
    errorEl.classList.remove("hidden");
  }

  if (errorMessage) {
    errorMessage.textContent = message;
  }
}


// ============================================================
// RENDER QUOTE
// ============================================================

function renderQuote(quote) {

  setText(
    "postcode",
    quote.postcode
  );


  const vehicle = [
    quote.vehicle_make,
    quote.vehicle_model
  ]
    .filter(Boolean)
    .join(" ");


  setText(
    "vehicle",
    vehicle
  );


  setText(
    "serviceType",
    quote.service_type
  );


  // Job title

  const title =
    document.getElementById("jobTitle");

  if (title) {

    title.textContent =
      vehicle
        ? `${vehicle} repair`
        : "ScuffIQ job";
  }


  // AI estimate

  const aiPrice =
    document.getElementById("aiPrice");

  if (aiPrice) {
    aiPrice.textContent =
      getAiPrice(quote);
  }


  // AI assessment

  const assessment =
    document.getElementById("aiAssessment");

  if (assessment) {

    assessment.textContent =
      quote.ai_assessment_1 ||
      "Review the uploaded damage photos to confirm the repair.";
  }


  // AI confidence

  const confidence =
    document.getElementById("aiConfidence");

  if (confidence) {

    confidence.textContent =
      quote.ai_confidence_1
        ? `Confidence: ${quote.ai_confidence_1}`
        : "Confidence: —";
  }


  // Photos

  const photos =
    getPhotoUrls(quote);

  const count =
    document.getElementById("photoCount");

  if (count) {

    count.textContent =
      `${photos.length} photo${photos.length === 1 ? "" : "s"}`;
  }


  renderPhotos(quote);


  // Status

  const status =
    document.getElementById("jobStatus");

  if (status) {

    status.textContent =
      formatStatus(
        quote.status ||
        "sent_to_technician"
      );
  }


  // AI price as example placeholder

  const priceInput =
    document.getElementById("technicianPrice");

  if (priceInput && !priceInput.value) {

    const price =
      getAiPrice(quote);

    if (
      price &&
      price !== "Technician review required"
    ) {

      priceInput.placeholder =
        `e.g. ${price}`;
    }
  }
}


function formatStatus(status) {

  return String(status || "")
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      char => char.toUpperCase()
    );
}


// ============================================================
// DAMAGE PHOTOS
// ============================================================

function renderPhotos(quote) {

  const photoGrid =
    document.getElementById("photoGrid");

  if (!photoGrid) {
    return;
  }


  const photos =
    getPhotoUrls(quote);


  if (!photos.length) {

    photoGrid.innerHTML = `
      <div class="empty-card">
        No damage photos found for this job.
      </div>
    `;

    return;
  }


  photoGrid.innerHTML =
    photos
      .map((url, index) => {

        const safeUrl =
          esc(url);

        return `
          <button
            class="photo-card"
            type="button"
            data-photo-url="${safeUrl}"
          >

            <img
              src="${safeUrl}"
              alt="Damage photo ${index + 1}"
            >

            <span>
              Photo ${index + 1}
            </span>

          </button>
        `;
      })
      .join("");


  photoGrid
    .querySelectorAll(".photo-card")
    .forEach(button => {

      button.addEventListener(
        "click",
        function () {

          const url =
            this.getAttribute(
              "data-photo-url"
            );

          if (url) {

            window.open(
              url,
              "_blank",
              "noopener,noreferrer"
            );
          }
        }
      );
    });
}


// ============================================================
// SUCCESS MESSAGE
// ============================================================

function showSuccess(message) {

  const app =
    document.getElementById("jobContent");

  const success =
    document.getElementById("successState");


  if (app) {
    app.classList.add("hidden");
  }


  if (success) {

    success.classList.remove("hidden");

    const messageElement =
      success.querySelector("p");

    if (messageElement) {
      messageElement.textContent =
        message;
    }
  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ============================================================
// SUBMIT REVIEW
// ============================================================

async function submitTechnicianQuote() {

  if (!currentQuote) {

    alert(
      "No job loaded."
    );

    return;
  }


  const decision =
    getInputValue("decision");

  const price =
    getInputValue("technicianPrice");

  const availability =
    getAvailability();

  const repairTime =
    getInputValue("repairTime");

  const notes =
    getInputValue("notes");


  // DECLINE

  if (decision === "declined") {

    await declineJob();

    return;
  }


  // MORE INFORMATION

  if (decision === "more_info") {

    await requestMoreInfo();

    return;
  }


  // ACCEPTED JOB MUST HAVE PRICE

  if (!price) {

    alert(
      "Please enter your confirmed price."
    );

    const input =
      document.getElementById(
        "technicianPrice"
      );

    if (input) {
      input.focus();
    }

    return;
  }


  // ACCEPTED JOB MUST HAVE AVAILABILITY

  if (!availability) {

    alert(
      "Please select at least one AM or PM availability slot."
    );

    const availabilityBox =
      document.getElementById(
        "availabilityOptions"
      );

    if (availabilityBox) {

      availabilityBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    return;
  }


  const button =
    document.getElementById("submitBtn");


  if (button) {

    button.disabled = true;

    button.textContent =
      "Submitting...";
  }


  const payload = {

    technician_price:
      price,

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


  // Save repair time if column exists

  if (repairTime) {

    payload.estimated_repair_time =
      repairTime;
  }


  try {

    await supaFetch(
      `quote_submissions?id=eq.${currentQuote.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      }
    );


    showSuccess(
      "Quote confirmed. ScuffIQ will review your price and availability before contacting the customer."
    );


  } catch (error) {

    console.error(
      "Submit quote error:",
      error
    );


    // If estimated_repair_time
    // hasn't been added to Supabase yet,
    // retry without it.

    if (
      repairTime &&
      String(error.message)
        .toLowerCase()
        .includes(
          "estimated_repair_time"
        )
    ) {

      try {

        delete payload
          .estimated_repair_time;


        await supaFetch(
          `quote_submissions?id=eq.${currentQuote.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );


        showSuccess(
          "Quote confirmed. ScuffIQ will review your price and availability before contacting the customer."
        );


        return;


      } catch (retryError) {

        console.error(
          "Retry error:",
          retryError
        );
      }
    }


    alert(
      "Could not submit your review. Please contact ScuffIQ."
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        "Submit review";
    }
  }
}


// ============================================================
// DECLINE JOB
// ============================================================

async function declineJob() {

  if (!currentQuote) {
    return;
  }


  const confirmed =
    confirm(
      "Are you sure you want to decline this job? ScuffIQ will assign it to another technician."
    );


  if (!confirmed) {
    return;
  }


  const notes =
    getInputValue("notes");


  try {

    await supaFetch(
      `quote_submissions?id=eq.${currentQuote.id}`,
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
      "Job declined. ScuffIQ will assign this repair to another technician."
    );


  } catch (error) {

    console.error(
      "Decline error:",
      error
    );


    alert(
      "Could not decline the job. Please contact ScuffIQ."
    );
  }
}


// ============================================================
// REQUEST MORE INFORMATION
// ============================================================

async function requestMoreInfo() {

  if (!currentQuote) {
    return;
  }


  const notes =
    getInputValue("notes");


  if (!notes) {

    alert(
      "Please explain what additional photos or information you need in Technician notes."
    );

    const notesBox =
      document.getElementById("notes");

    if (notesBox) {
      notesBox.focus();
    }

    return;
  }


  try {

    await supaFetch(
      `quote_submissions?id=eq.${currentQuote.id}`,
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
      "Request sent. ScuffIQ will obtain the additional information."
    );


  } catch (error) {

    console.error(
      "More information error:",
      error
    );


    alert(
      "Could not submit the request. Please contact ScuffIQ."
    );
  }
}


// ============================================================
// INITIALISE PAGE
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  function () {

    // Creates next 14 days
    // with AM + PM options
    populateAvailabilityOptions();


    // Loads job from token
    loadTechnicianQuote();


    // Handles submission
    const form =
      document.getElementById(
        "reviewForm"
      );


    if (form) {

      form.addEventListener(
        "submit",
        function (event) {

          event.preventDefault();

          submitTechnicianQuote();
        }
      );
    }
  }
);
