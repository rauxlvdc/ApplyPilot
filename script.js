
/* ApplyPilot — Supabase connection */
const SUPABASE_URL = "https://wwgamfkkjiujomnvorto.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2JdtENuR3zRSeKZxhbaRew_xC6OPepZ";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


(() => {
  "use strict";

  const STORAGE = {
    applications: "applypilot_v2_applications",
    resume: "applypilot_v2_resume_text",
    profile: "applypilot_v2_profile",
    onboarding: "applypilot_v2_onboarding_done"
  };
  const STATUS_OPTIONS = ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let applications = readStore(STORAGE.applications, []);
  let profile = readStore(STORAGE.profile, { name: "", targetRole: "", workPreference: "" });
  let currentView = "dashboard";
  let toastTimeout;
  let confirmCallback = null;

  function readStore(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn("Could not read local data:", error);
      return fallback;
    }
  }
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showToast("This browser couldn't save the data. Check storage settings.");
      return false;
    }
  }
  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }
  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  function formatDate(date) {
    if (!date) return "—";
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  function saveApplications() {
    writeStore(STORAGE.applications, applications);
    renderAll();
  }
  function saveProfile() {
    writeStore(STORAGE.profile, profile);
    renderProfile();
  }
  function renderProfile() {
    const name = profile.name.trim() || "Your profile";
    const initial = profile.name.trim().charAt(0).toUpperCase() || "Y";
    $("#sideName").textContent = name;
    $("#topName").textContent = profile.name.trim() ? `Hi, ${profile.name.trim().split(/\s+/)[0]}` : "Hi there";
    $("#sideAvatar").textContent = initial;
    $("#topAvatar").textContent = initial;
    $("#profileName").value = profile.name || "";
    $("#targetRole").value = profile.targetRole || "";
    $("#workPreference").value = profile.workPreference || "";
    $("#onboardingName").value = profile.name || "";
    $("#onboardingRole").value = profile.targetRole || "";
    if (!$("#resumeText").value) $("#resumeText").value = localStorage.getItem(STORAGE.resume) || "";
  }
  function statusClass(status) {
    return "status-" + String(status).toLowerCase().replace(/[^a-z]+/g, "-");
  }
  function renderStats() {
    const saved = applications.filter(app => app.status === "Saved").length;
    const progress = applications.filter(app => ["Applied", "Assessment", "Interview"].includes(app.status)).length;
    const interviews = applications.filter(app => app.status === "Interview").length;
    const offers = applications.filter(app => app.status === "Offer").length;
    $("#statSaved").textContent = saved;
    $("#statProgress").textContent = progress;
    $("#statInterviews").textContent = interviews;
    $("#statOffers").textContent = offers;
    const resume = localStorage.getItem(STORAGE.resume) || "";
    if (!resume.trim()) {
      $("#nextStepTitle").textContent = "Add your resume";
      $("#nextStepText").textContent = "Upload a PDF or DOCX to get started with keyword matching.";
      $("#nextStepButton").textContent = "Set up my resume →";
      $("#nextStepButton").dataset.viewLink = "resume";
    } else if (!applications.length) {
      $("#nextStepTitle").textContent = "Save a role that interests you";
      $("#nextStepText").textContent = "Add one opportunity to your tracker to start building momentum.";
      $("#nextStepButton").textContent = "Add an application →";
      $("#nextStepButton").dataset.viewLink = "tracker";
    } else {
      $("#nextStepTitle").textContent = "Keep your momentum";
      $("#nextStepText").textContent = "Review your next follow-up and keep your application details current.";
      $("#nextStepButton").textContent = "Open tracker →";
      $("#nextStepButton").dataset.viewLink = "tracker";
    }
  }
  function renderRecent() {
    const root = $("#recentApplications");
    const latest = [...applications].sort((a, b) => (b.updatedAt || b.date || "").localeCompare(a.updatedAt || a.date || "")).slice(0, 4);
    if (!latest.length) {
      root.innerHTML = '<div class="recent-empty">Your first application can go here. Start with a role that catches your eye. ♡</div>';
      return;
    }
    root.innerHTML = latest.map((app, index) => `
      <div class="recent-item">
        <div class="company-mark color-${index % 4}">${safeText((app.company || "?").trim().charAt(0).toUpperCase())}</div>
        <div class="recent-info"><strong>${safeText(app.role)}</strong><small>${safeText(app.company)} · ${safeText(formatDate(app.date))}</small></div>
        <span class="status-pill ${statusClass(app.status)}">${safeText(app.status)}</span>
      </div>`).join("");
  }
  function renderApplications() {
    const body = $("#applicationTableBody");
    const search = $("#applicationSearch").value.trim().toLowerCase();
    const filter = $("#statusFilter").value;
    const visible = [...applications]
      .filter(app => filter === "all" || app.status === filter)
      .filter(app => `${app.role} ${app.company} ${app.notes || ""}`.toLowerCase().includes(search))
      .sort((a, b) => (b.updatedAt || b.date || "").localeCompare(a.updatedAt || a.date || ""));
    body.innerHTML = visible.map(app => {
      const safeUrl = normalizeUrl(app.url);
      return `<tr>
        <td><span class="table-role">${safeText(app.role)}</span><span class="table-company">${safeText(app.company)}</span>${app.notes ? `<span class="table-company">${safeText(app.notes.slice(0, 90))}${app.notes.length > 90 ? "…" : ""}</span>` : ""}</td>
        <td><span class="status-pill ${statusClass(app.status)}">${safeText(app.status)}</span></td>
        <td>${safeText(formatDate(app.date))}</td>
        <td>${safeUrl ? `<a class="job-link" href="${safeText(safeUrl)}" target="_blank" rel="noopener noreferrer">Open ↗</a>` : '<span class="muted">—</span>'}</td>
        <td><div class="table-actions"><button class="table-action" data-edit-app="${safeText(app.id)}">Edit</button><button class="table-action" data-delete-app="${safeText(app.id)}">Delete</button></div></td>
      </tr>`;
    }).join("");
    $("#emptyApplications").classList.toggle("show", visible.length === 0);
    $("#emptyApplications h3").textContent = applications.length && (search || filter !== "all") ? "No matching applications" : "No applications just yet";
    $("#emptyApplications p").textContent = applications.length && (search || filter !== "all") ? "Try another search or status filter." : "Add a role you're interested in and keep track of what happens next.";
    $("#emptyAddButton").style.display = applications.length && (search || filter !== "all") ? "none" : "inline-flex";
  }
  function renderAll() {
    renderStats();
    renderRecent();
    renderApplications();
  }
  function goToView(view) {
    if (!["dashboard", "resume", "analyzer", "tracker"].includes(view)) return;
    currentView = view;
    $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
    $$("[data-view-link]").forEach(button => {
      const active = button.dataset.viewLink === view;
      button.classList.toggle("active", active);
      if (button.classList.contains("mobile-nav-link")) button.setAttribute("aria-current", active ? "page" : "false");
    });
    const titles = {
      dashboard: "A little progress goes a long way ✳",
      resume: "Your experience deserves to shine",
      analyzer: "Find the important details ✦",
      tracker: "Every application has a next step"
    };
    $("#pageTitle").textContent = titles[view];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function normalizeUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const url = new URL(text);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }
  function openApplicationDialog(app = null) {
    $("#applicationForm").reset();
    $("#applicationFormError").textContent = "";
    $("#applicationId").value = app?.id || "";
    $("#applicationDialogTitle").textContent = app ? "Edit application" : "Add application";
    $("#applicationRole").value = app?.role || "";
    $("#applicationCompany").value = app?.company || "";
    $("#applicationStatus").value = app?.status || "Saved";
    $("#applicationDate").value = app?.date || todayISO();
    $("#applicationUrl").value = app?.url || "";
    $("#applicationNotes").value = app?.notes || "";
    $("#applicationDialog").showModal();
  }
  function requestDelete(id) {
    const app = applications.find(item => item.id === id);
    if (!app) return;
    $("#confirmTitle").textContent = "Delete this application?";
    $("#confirmMessage").textContent = `Remove "${app.role}" at ${app.company} from your tracker? This can't be undone.`;
    confirmCallback = () => {
      applications = applications.filter(item => item.id !== id);
      saveApplications();
      showToast("Application deleted.");
    };
    $("#confirmDialog").showModal();
  }

  // Keyword extraction is intentionally heuristic, not a generative AI assessment.
  const STOPWORDS = new Set(("a an the and or but if then than to of in on for with by from as at is are was were be been being it its this that these those you your we our they their them he she his her i me my will can could should would may might must have has had do does did not no yes about into over under across per more most very also other such role position job work working experience experienced ability able strong excellent good required preferred requirements responsibilities qualifications qualification skill skills team company candidate applicant using use used include including ensure support provide manage maintain develop help communication communicate written verbal english data information research analysis analyze analytical attention detail organize organized organization problem solving solve deadline deadlines multiple independently collaboratively remote hybrid tools software microsoft excel word google documentation report reporting customer clients service fast pace fast-paced").split(/\s+/));
  const SKILL_PHRASES = [
    "attention to detail","critical thinking","problem solving","time management","project management",
    "quality assurance","content moderation","data annotation","data analysis","information retrieval",
    "written communication","verbal communication","customer service","team collaboration","cross-functional",
    "natural language processing","machine learning","large language models","language models",
    "proofreading","editing","research","writing","documentation","synthesis","summarization",
    "communication","organization","accuracy","confidentiality","recruitment","sourcing",
    "screening","evaluation","annotation","labeling","labelling","transcription","translation",
    "english","filipino","tagalog","excel","google sheets","microsoft office","google workspace",
    "crm","salesforce","slack","notion","data entry","quality control","content writing",
    "social media","administrative support","calendar management","email management",
    "stakeholder management","leadership","adaptability","flexibility","critical analysis",
    "fact checking","fact-checking","web research","internet research","remote work"
  ];
  function normalizeText(text) {
    return String(text || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
  }
  function extractKeywords(text) {
    const normalized = normalizeText(text);
    const found = new Map();
    for (const phrase of SKILL_PHRASES) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = normalized.match(new RegExp(`\\b${escaped}\\b`, "g"));
      if (matches) found.set(phrase, matches.length);
    }
    const words = normalized.match(/\b[a-z][a-z+#.-]{2,}\b/g) || [];
    const frequencies = new Map();
    for (const word of words) {
      if (STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
    [...frequencies.entries()]
      .filter(([word, count]) => count >= 2 && !found.has(word))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .forEach(([word, count]) => found.set(word, count));
    return [...found.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 24);
  }
  function renderAnalyzer() {
    const jobText = $("#jobDescriptionInput").value.trim();
    if (jobText.length < 40) {
      showToast("Add a little more of the job description first.");
      $("#jobDescriptionInput").focus();
      return;
    }
    const keywords = extractKeywords(jobText);
    const resumeText = $("#resumeText").value.trim() || localStorage.getItem(STORAGE.resume) || "";
    $("#keywordChips").innerHTML = keywords.length
      ? keywords.map(([word, count]) => `<span class="keyword-chip">${safeText(word)}<span class="count">×${count}</span></span>`).join("")
      : '<p>No clear recurring keywords found. Try including the full job description.</p>';
    const tips = [
      "Prioritize requirements that appear in the job post and genuinely match your experience.",
      "Use specific examples and outcomes in your resume instead of adding keywords without context.",
      "Check the application instructions, work schedule, location eligibility, and required tools.",
      "Tailor your summary and most relevant bullet points for this role, while keeping every claim accurate."
    ];
    if (!resumeText) tips.unshift("Upload or paste your resume in My resume to see which detected terms also appear in your document.");
    $("#analysisTips").innerHTML = tips.map(tip => `<li>${safeText(tip)}</li>`).join("");
    renderMatch(keywords.map(([word]) => word), resumeText);
    $("#analyzerResults").hidden = false;
    $("#analyzerResults").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderMatch(keywords, resumeText) {
    const normalizedResume = normalizeText(resumeText);
    const matched = keywords.filter(word => normalizedResume.includes(normalizeText(word)));
    const missing = keywords.filter(word => !normalizedResume.includes(normalizeText(word)));
    const score = keywords.length ? Math.round(matched.length / keywords.length * 100) : 0;
    $("#matchSummary").innerHTML = `<div class="match-score">${resumeText ? score + "%" : "—"}</div><div><strong>${resumeText ? `${matched.length} of ${keywords.length} terms found` : "Add your resume to compare"}</strong><p>${resumeText ? "This is a simple keyword overlap check, not a hiring probability, ATS score, or judgement of your qualifications." : "Your resume text is currently empty. Upload a PDF/DOCX or paste text on the My resume page."}</p></div>`;
    $("#matchDetails").innerHTML = `<div class="match-list"><h4>✓ Found in resume (${resumeText ? matched.length : 0})</h4><p class="good">${resumeText && matched.length ? matched.map(safeText).join(" · ") : "No matching terms yet."}</p></div><div class="match-list"><h4>＋ Not found (${resumeText ? missing.length : keywords.length})</h4><p class="missing">${missing.length ? missing.map(safeText).join(" · ") : "All detected terms appeared in your resume text."}</p></div>`;
  }

  async function extractPdf(file) {
    if (!window.pdfjsLib) throw new Error("The PDF reader library didn't load. Check your internet connection and try again.");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pageTexts = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map(item => item.str || "").join(" "));
    }
    return pageTexts.join("\n\n");
  }
  async function extractDocx(file) {
    if (!window.mammoth) throw new Error("The Word document reader didn't load. Check your internet connection and try again.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value || "";
  }
  async function handleResumeFile(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx"].includes(ext)) {
      showToast("Please choose a PDF or DOCX file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("That file is over 8 MB. Please choose a smaller copy.");
      return;
    }
    $("#resumeFileStatus").textContent = `Reading ${file.name}…`;
    try {
      const extracted = ext === "pdf" ? await extractPdf(file) : await extractDocx(file);
      if (!extracted.trim()) {
        $("#resumeFileStatus").textContent = "No selectable text was found in this file.";
        showToast("This file may be a scanned image. Try a text-based PDF or paste the text.");
        return;
      }
      $("#resumeText").value = extracted.trim();
      $("#resumeFileStatus").textContent = `Extracted text from ${file.name}. Review it below, then select “Save resume text”.`;
      $("#resumeSaveStatus").textContent = "Not saved yet — choose Save resume text to keep this text in this browser.";
      showToast("Resume text extracted. Please review it before saving.");
    } catch (error) {
      console.error(error);
      $("#resumeFileStatus").textContent = error.message || "Couldn't read this file.";
      showToast(error.message || "Couldn't read this file.");
    }
  }

  // Navigation and dashboard
  $$("[data-view-link]").forEach(button => button.addEventListener("click", () => {
    const destination = button.dataset.viewLink;
    if (destination === "tracker" && button.id === "nextStepButton" && !applications.length) openApplicationDialog();
    goToView(destination);
  }));
  $("#editProfileButton").addEventListener("click", () => { goToView("resume"); $("#profileName").focus(); });
  $("#topProfileButton").addEventListener("click", () => { goToView("resume"); $("#profileName").focus(); });
  $("#addApplicationButton").addEventListener("click", () => openApplicationDialog());
  $("#emptyAddButton").addEventListener("click", () => openApplicationDialog());
  $("#applicationSearch").addEventListener("input", renderApplications);
  $("#statusFilter").addEventListener("change", renderApplications);

  // Application tracker
  $("#applicationForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#applicationId").value || (window.crypto?.randomUUID ? crypto.randomUUID() : `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const role = $("#applicationRole").value.trim();
    const company = $("#applicationCompany").value.trim();
    const urlText = $("#applicationUrl").value.trim();
    if (!role || !company) {
      $("#applicationFormError").textContent = "Please add both a job title and company.";
      return;
    }
    if (urlText && !normalizeUrl(urlText)) {
      $("#applicationFormError").textContent = "Please enter a valid link starting with https:// or http://.";
      return;
    }
    const old = applications.find(app => app.id === id);
    const item = {
      id, role, company, status: $("#applicationStatus").value,
      date: $("#applicationDate").value || todayISO(),
      url: normalizeUrl(urlText), notes: $("#applicationNotes").value.trim(),
      updatedAt: new Date().toISOString(), createdAt: old?.createdAt || new Date().toISOString()
    };
    applications = old ? applications.map(app => app.id === id ? item : app) : [item, ...applications];
    saveApplications();
    $("#applicationDialog").close();
    showToast(old ? "Application updated." : "Application saved.");
  });
  $("#closeApplicationDialog").addEventListener("click", () => $("#applicationDialog").close());
  $("#cancelApplicationButton").addEventListener("click", () => $("#applicationDialog").close());
  $("#applicationTableBody").addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-app]");
    const deleteButton = event.target.closest("[data-delete-app]");
    if (editButton) {
      const app = applications.find(item => item.id === editButton.dataset.editApp);
      if (app) openApplicationDialog(app);
    }
    if (deleteButton) requestDelete(deleteButton.dataset.deleteApp);
  });
  $("#confirmDialog").addEventListener("close", () => {
    if ($("#confirmDialog").returnValue === "confirm" && confirmCallback) confirmCallback();
    confirmCallback = null;
  });
  $("#confirmAction").addEventListener("click", event => {
    event.preventDefault();
    $("#confirmDialog").close("confirm");
  });

  // Resume upload, local save, and optional profile details
  $("#resumeFile").addEventListener("change", event => handleResumeFile(event.target.files?.[0]));
  const dropzone = $("#resumeDropzone");
  ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault(); dropzone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault(); dropzone.classList.remove("dragover");
  }));
  dropzone.addEventListener("drop", event => handleResumeFile(event.dataTransfer?.files?.[0]));
  $("#saveResumeButton").addEventListener("click", () => {
    const text = $("#resumeText").value.trim();
    if (!text) {
      localStorage.removeItem(STORAGE.resume);
      $("#resumeSaveStatus").textContent = "No resume text saved.";
      renderStats();
      showToast("Resume text cleared.");
      return;
    }
    if (writeStore(STORAGE.resume, text)) {
      $("#resumeSaveStatus").textContent = `Saved ${text.length.toLocaleString()} characters in this browser.`;
      renderStats();
      showToast("Resume text saved in this browser.");
    }
  });
  $("#clearResumeButton").addEventListener("click", () => {
    $("#resumeText").value = "";
    localStorage.removeItem(STORAGE.resume);
    $("#resumeSaveStatus").textContent = "Resume text cleared from this browser.";
    $("#resumeFileStatus").textContent = "No file selected yet.";
    renderStats();
    showToast("Resume text cleared.");
  });
  $("#profileForm").addEventListener("submit", event => {
    event.preventDefault();
    profile = {
      name: $("#profileName").value.trim(),
      targetRole: $("#targetRole").value.trim(),
      workPreference: $("#workPreference").value
    };
    saveProfile();
    $("#profileSaveStatus").textContent = "Saved in this browser.";
    showToast("Your details are saved.");
  });
  $("#onboardingForm").addEventListener("submit", event => {
    event.preventDefault();
    profile.name = $("#onboardingName").value.trim();
    profile.targetRole = $("#onboardingRole").value.trim();
    saveProfile();
    writeStore(STORAGE.onboarding, true);
    $("#onboardingDialog").close();
    showToast("Welcome to ApplyPilot!");
  });
  $("#skipOnboarding").addEventListener("click", () => {
    writeStore(STORAGE.onboarding, true);
    $("#onboardingDialog").close();
  });
  $("#analyzeJobButton").addEventListener("click", renderAnalyzer);
  $("#jobDescriptionInput").addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") renderAnalyzer();
  });

  
  // ApplyPilot account authentication
  const authDialog = $("#authDialog");
  const authForm = $("#authForm");
  const authTitle = $("#authTitle");
  const authDescription = $("#authDescription");
  const authEmail = $("#authEmail");
  const authPassword = $("#authPassword");
  const authStatus = $("#authStatus");
  const authSwitchButton = $("#authSwitchButton");
  const authSubmitButton = $("#authSubmitButton");

  let authMode = "signup";

  function setAuthMode(mode) {
    authMode = mode;
    const isSignup = mode === "signup";

    authTitle.textContent = isSignup
      ? "Create your account"
      : "Sign in to ApplyPilot";

    authDescription.textContent = isSignup
      ? "Sign up to start organizing your job search."
      : "Welcome back. Sign in to continue.";

    authPassword.autocomplete = isSignup
      ? "new-password"
      : "current-password";

    authSubmitButton.textContent = isSignup
      ? "Create account"
      : "Sign in";

    authSwitchButton.textContent = isSignup
      ? "I already have an account"
      : "Create a new account";

    authStatus.textContent = "";
  }

  authSwitchButton.addEventListener("click", () => {
    setAuthMode(authMode === "signup" ? "login" : "signup");
  });

  authForm.addEventListener("submit", async event => {
    event.preventDefault();

    authStatus.textContent = "Please wait…";
    authSubmitButton.disabled = true;

    try {
      const email = authEmail.value.trim();
      const password = authPassword.value;

      const result = authMode === "signup"
        ? await supabaseClient.auth.signUp({ email, password })
        : await supabaseClient.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        authStatus.textContent =
          "Account created. Check your email to confirm your address, then sign in.";
        setAuthMode("login");
        return;
      }

      authDialog.close();
      showToast("You're signed in!");

    } catch (error) {
      authStatus.textContent =
        error.message || "Authentication failed. Please try again.";
    } finally {
      authSubmitButton.disabled = false;
    }
  });

  // Open the account dialog when the user is not signed in.
  async function checkAuthSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Could not check the session:", error.message);
      return;
    }

    if (!data.session) {
      setAuthMode("signup");
      if (!authDialog.open) authDialog.showModal();
    }
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && authDialog.open) {
      authDialog.close();
    }
  });

  checkAuthSession();

  // Keep the greeting current without requiring network access.
  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  renderProfile();
  renderAll();
  if (!readStore(STORAGE.onboarding, false)) {
    // Show once for this browser; profile and resume setup can also be opened later.
    window.setTimeout(() => {
      if (!$("#onboardingDialog").open) $("#onboardingDialog").showModal();
    }, 250);
  }
})();
