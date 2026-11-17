"use strict";

// Backend address. All services are called from the browser (CORS).
const API_BASE = "https://lifeexpectancy.stats.org.pl";

const SECONDS_PER_YEAR = 31557600; // 365.25 days, same as the backend
const SECONDS_PER_DAY = 86400;
const STORAGE_KEY = "lifeExpectancy.v1";
// Survey answers are kept apart and only on this device (never sent anywhere).
const SURVEY_KEY = "lifeExpectancy.survey.v1";

// ------------------------------------------------------------
// Translations. Add a language by adding a block with the same keys.
// ------------------------------------------------------------

const TEXT = {
  en: {
    title: "Expected lifespan",
    country: "Country",
    chooseCountry: "Choose a country…",
    loadingCountries: "Loading countries…",
    birthDate: "Date of birth",
    sex: "Sex",
    male: "Male",
    female: "Female",
    notSpecified: "Not specified",
    calculate: "Calculate",
    calculating: "Calculating…",
    remaining: "Expected remaining time",
    expectedDate: "Expected date",
    change: "Change",
    errCountry: "Please choose a country.",
    errBirthDate: "Please enter a valid date of birth (not in the future, at most 120 years ago).",
    errNetwork: "Cannot reach the server. Check your connection and try again.",
    errServer: "Server error: ",
    errCountries: "Could not load the list of countries.",
    note: (year) => `Statistical estimate based on WHO life tables (${year}) for the selected country and sex. It is not a personal prediction.`,
    years: (n) => (n === 1 ? "year" : "years"),
    days: (n) => (n === 1 ? "day" : "days"),

    // Survey
    surveyButton: "Short survey",
    surveyEdit: "Edit survey",
    surveyHint: "Answer 5 short questions to personalise the estimate.",
    surveyTitle: "Short survey (optional)",
    noticeTitle: "Your answers stay on this device.",
    noticeBody: "They are used here, on your device, to calculate a single risk multiplier. Only that number is sent to our server — never your answers — and the server does not store it. You can skip any question, and you can choose not to have your answers remembered on this device.",
    privacyMore: "More about privacy",
    privacyDetails: "The number sent to the server combines all your answers, so it does not show which answer caused what. If you answer only one question, the number may hint at that answer. It is sent over an encrypted connection, is not part of the web address, and is not saved on the server. The breakdown of how each answer changes the result is calculated on your device only.",
    preferNot: "Prefer not to say",
    qSmoking: "Do you smoke cigarettes or other tobacco?",
    smokeNever: "Never smoked",
    smokeFormer: "Used to – quit at age",
    smokeCurrent: "Smoke now",
    qBody: "Height and weight",
    heightCm: "Height (cm)",
    weightKg: "Weight (kg)",
    bodyHint: "Leave empty to skip.",
    bmiValue: (v) => `BMI: ${v}`,
    qActivity: "Exercise per week (brisk walking, cycling, sport)",
    activityHint: "Count minutes of vigorous effort twice.",
    actNone: "None",
    actLow: "Less than 150 min",
    actGuideline: "150–299 min",
    actDouble: "300–449 min",
    actHigh: "450 min or more",
    qAlcohol: "Alcoholic drinks per week",
    alcoholHint: "One drink ≈ 10 g of alcohol: a small beer (250 ml), a glass of wine (100 ml) or a shot of spirits (30 ml).",
    alcNone: "None",
    alcLight: "1–10",
    alcModerate: "11–20",
    alcHeavy: "21–35",
    alcVeryHeavy: "More than 35",
    qParents: "Your parents",
    parentsHint: "Skip a parent who died in an accident or by violence.",
    mother: "Mother",
    father: "Father",
    parentUnknown: "Don't know / prefer not to say",
    parentAlive: "Alive, aged",
    parentDead: "Died at age",
    remember: "Remember my answers on this device",
    apply: "Apply",
    applying: "Calculating…",
    cancel: "Cancel",
    clearAnswers: "Clear answers",
    errSurvey: "Please check the highlighted answers.",
    breakdownTitle: "How your answers change the result",
    factorNames: { smoking: "Smoking", bmi: "Body weight (BMI)", activity: "Physical activity", alcohol: "Alcohol", parents: "Parents" },
    yearsDecimal: () => "years",
    surveyEffect: (v) => `Survey: ${v} years compared with the national average`,
    rangeYears: (a, b) => (a === b ? `Most likely in ${a}` : `Most likely between ${a} and ${b}`),
    approxNote: "Some national averages used for comparison are approximate.",
    surveyNote: "Survey effects are estimated from large published studies.",
  },
  pl: {
    title: "Oczekiwana długość życia",
    country: "Kraj",
    chooseCountry: "Wybierz kraj…",
    loadingCountries: "Wczytywanie krajów…",
    birthDate: "Data urodzenia",
    sex: "Płeć",
    male: "Mężczyzna",
    female: "Kobieta",
    notSpecified: "Nie podano",
    calculate: "Oblicz",
    calculating: "Obliczanie…",
    remaining: "Oczekiwany pozostały czas",
    expectedDate: "Przewidywana data",
    change: "Zmień",
    errCountry: "Wybierz kraj.",
    errBirthDate: "Podaj poprawną datę urodzenia (nie z przyszłości, najwyżej 120 lat temu).",
    errNetwork: "Brak połączenia z serwerem. Sprawdź połączenie i spróbuj ponownie.",
    errServer: "Błąd serwera: ",
    errCountries: "Nie udało się wczytać listy krajów.",
    note: (year) => `Szacunek statystyczny na podstawie tablic trwania życia WHO (${year}) dla wybranego kraju i płci. Nie jest to indywidualna prognoza.`,
    years: (n) => plPlural(n, "rok", "lata", "lat"),
    days: (n) => (n === 1 ? "dzień" : "dni"),

    // Ankieta
    surveyButton: "Krótka ankieta",
    surveyEdit: "Edytuj ankietę",
    surveyHint: "Odpowiedz na 5 krótkich pytań, aby dopasować szacunek do siebie.",
    surveyTitle: "Krótka ankieta (opcjonalna)",
    noticeTitle: "Twoje odpowiedzi pozostają na tym urządzeniu.",
    noticeBody: "Służą tutaj, na Twoim urządzeniu, do obliczenia jednego współczynnika ryzyka. Na nasz serwer wysyłana jest tylko ta liczba — nigdy Twoje odpowiedzi — i serwer jej nie zapisuje. Możesz pominąć dowolne pytanie i zdecydować, by odpowiedzi nie były zapamiętywane na tym urządzeniu.",
    privacyMore: "Więcej o prywatności",
    privacyDetails: "Liczba wysyłana na serwer łączy wszystkie odpowiedzi, więc nie widać z niej, która odpowiedź za co odpowiada. Jeśli odpowiesz tylko na jedno pytanie, liczba może sugerować tę odpowiedź. Jest wysyłana szyfrowanym połączeniem, nie jest częścią adresu strony i nie jest zapisywana na serwerze. Rozbicie wpływu poszczególnych odpowiedzi na wynik jest liczone wyłącznie na Twoim urządzeniu.",
    preferNot: "Wolę nie odpowiadać",
    qSmoking: "Czy palisz papierosy lub inny tytoń?",
    smokeNever: "Nigdy nie paliłem(-am)",
    smokeFormer: "Paliłem(-am) – rzuciłem(-am) w wieku",
    smokeCurrent: "Palę obecnie",
    qBody: "Wzrost i masa ciała",
    heightCm: "Wzrost (cm)",
    weightKg: "Masa ciała (kg)",
    bodyHint: "Pozostaw puste, aby pominąć.",
    bmiValue: (v) => `BMI: ${v}`,
    qActivity: "Ruch tygodniowo (szybki marsz, rower, sport)",
    activityHint: "Minuty intensywnego wysiłku licz podwójnie.",
    actNone: "Wcale",
    actLow: "Mniej niż 150 min",
    actGuideline: "150–299 min",
    actDouble: "300–449 min",
    actHigh: "450 min lub więcej",
    qAlcohol: "Porcje alkoholu tygodniowo",
    alcoholHint: "Jedna porcja ≈ 10 g alkoholu: małe piwo (250 ml), lampka wina (100 ml) lub kieliszek wódki (30 ml).",
    alcNone: "Żadnej",
    alcLight: "1–10",
    alcModerate: "11–20",
    alcHeavy: "21–35",
    alcVeryHeavy: "Więcej niż 35",
    qParents: "Twoi rodzice",
    parentsHint: "Pomiń rodzica, który zmarł w wypadku lub w wyniku przemocy.",
    mother: "Matka",
    father: "Ojciec",
    parentUnknown: "Nie wiem / wolę nie odpowiadać",
    parentAlive: "Żyje, w wieku",
    parentDead: "Zmarł(a) w wieku",
    remember: "Zapamiętaj moje odpowiedzi na tym urządzeniu",
    apply: "Zastosuj",
    applying: "Obliczanie…",
    cancel: "Anuluj",
    clearAnswers: "Wyczyść odpowiedzi",
    errSurvey: "Sprawdź zaznaczone odpowiedzi.",
    breakdownTitle: "Jak Twoje odpowiedzi zmieniają wynik",
    factorNames: { smoking: "Palenie", bmi: "Masa ciała (BMI)", activity: "Aktywność fizyczna", alcohol: "Alkohol", parents: "Rodzice" },
    // With one decimal place Polish uses the genitive singular: "2,5 roku".
    yearsDecimal: () => "roku",
    surveyEffect: (v) => `Ankieta: ${v} roku względem średniej krajowej`,
    rangeYears: (a, b) => (a === b ? `Najprawdopodobniej w roku ${a}` : `Najprawdopodobniej w latach ${a}–${b}`),
    approxNote: "Część średnich krajowych użytych do porównania jest przybliżona.",
    surveyNote: "Wpływ odpowiedzi oszacowano na podstawie dużych opublikowanych badań.",
  },
};

function plPlural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many;
}

// ------------------------------------------------------------
// State and storage
// ------------------------------------------------------------

const state = {
  lang: "en",
  countries: [],      // from countries.php
  entries: null,      // { country, birthDate, sex }
  timeline: null,     // [{ t: ms, rem: seconds }]
  dataYear: null,
  refetching: false,
  timerId: null,
  survey: null,       // survey answers — stay on this device
  remember: true,     // keep survey answers in this browser
  riskModels: {},     // public factor tables per "country|sex"
  result: null,       // data for the survey summary (computed on this device)
};

function loadStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveStored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: state.lang, entries: state.entries, rememberSurvey: state.remember }));
  } catch (e) { /* storage unavailable: ignore */ }
}

function loadSurvey() {
  try {
    const s = JSON.parse(localStorage.getItem(SURVEY_KEY));
    return s && typeof s === "object" ? s : null;
  } catch (e) {
    return null;
  }
}

/** Keep survey answers in this browser only if the user allows it. */
function saveSurvey() {
  try {
    if (state.remember && state.survey) localStorage.setItem(SURVEY_KEY, JSON.stringify(state.survey));
    else localStorage.removeItem(SURVEY_KEY);
  } catch (e) { /* storage unavailable: ignore */ }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const t = (key, ...args) => {
  const v = TEXT[state.lang][key];
  return typeof v === "function" ? v(...args) : v;
};

function showError(el, message) {
  el.textContent = message || "";
  el.hidden = !message;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function isoDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function countryName(c) {
  if (c.iso2) {
    try {
      const name = new Intl.DisplayNames([state.lang], { type: "region" }).of(c.iso2);
      if (name && name !== c.iso2) return name;
    } catch (e) { /* fall back to server name */ }
  }
  return c.name;
}

function formatDate(isoOrDate, opts = { dateStyle: "long" }) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate + "T00:00:00") : isoOrDate;
  return new Intl.DateTimeFormat(state.lang, opts).format(d);
}

/**
 * Call a backend service. GET puts params in the URL; POST sends them as a
 * JSON body, so they do not appear in web server access logs.
 */
async function api(path, params, fetchOptions = {}) {
  const url = new URL(path, API_BASE + "/");
  const options = { headers: { Accept: "application/json" }, ...fetchOptions };
  if ((options.method || "GET").toUpperCase() === "POST") {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(params || {});
  } else {
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error(t("errNetwork"));
  }
  let body = null;
  try { body = await res.json(); } catch (e) { /* not JSON */ }
  if (!res.ok || !body || body.error) {
    throw new Error(t("errServer") + ((body && body.error) || `HTTP ${res.status}`));
  }
  return body;
}

// ------------------------------------------------------------
// Language
// ------------------------------------------------------------

/**
 * First supported language from the browser's preference list
 * (e.g. ["de-DE", "pl", "en"] -> "pl"); English if none is supported.
 */
function browserLanguage() {
  const prefs = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ""];
  for (const l of prefs) {
    const base = String(l).toLowerCase().split("-")[0];
    if (TEXT[base]) return base;
  }
  return "en";
}

function setLanguage(lang) {
  state.lang = TEXT[lang] ? lang : "en";
  document.documentElement.lang = state.lang;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll(".lang button").forEach((b) => {
    const active = b.dataset.lang === state.lang;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  renderCountryOptions();
  updateBmi();
  if (state.entries && state.timeline) {
    renderDetails();
    renderSurveySummary();
    renderTimer(true);
  }
  saveStored();
}

// ------------------------------------------------------------
// Countries
// ------------------------------------------------------------

function defaultCountryCode() {
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
  for (const l of langs) {
    const region = (l.split("-")[1] || "").toUpperCase();
    const hit = region && state.countries.find((c) => c.iso2 === region);
    if (hit) return hit.code;
  }
  for (const l of langs) {
    if (l.toLowerCase().startsWith("pl")) return "POL";
  }
  return "";
}

function renderCountryOptions() {
  const select = $("country");
  if (!state.countries.length) return;
  const selected = select.value || (state.entries && state.entries.country) || defaultCountryCode();
  const collator = new Intl.Collator(state.lang);
  const items = state.countries
    .map((c) => ({ code: c.code, name: countryName(c) }))
    .sort((a, b) => collator.compare(a.name, b.name));

  select.replaceChildren(new Option(t("chooseCountry"), ""));
  items.forEach((c) => select.add(new Option(c.name, c.code)));
  select.value = items.some((c) => c.code === selected) ? selected : "";
}

async function loadCountries() {
  const select = $("country");
  showError($("form-error"), "");
  try {
    const data = await api("countries.php");
    state.countries = data.countries || [];
    select.disabled = false;
    renderCountryOptions();
  } catch (e) {
    select.replaceChildren(new Option(t("errCountries"), ""));
    showError($("form-error"), e.message);
    throw e;
  }
}

// ------------------------------------------------------------
// Timeline and ticking
// ------------------------------------------------------------

/** Public factor table + national averages for country/sex (nothing personal sent). */
async function getRiskModel(country, sex) {
  const key = `${country}|${sex}`;
  if (!state.riskModels[key]) {
    state.riskModels[key] = await api("risk_model.php", { country, sex });
  }
  return state.riskModels[key];
}

function riskSex(sex) {
  return sex === "male" || sex === "female" ? sex : "both";
}

async function fetchTimeline(entries) {
  // Survey answers are turned into two multipliers HERE, on the device.
  // Only hr65/hr85 are sent — never the answers.
  let riskModel = null, hr = null;
  if (state.survey) {
    riskModel = await getRiskModel(entries.country, entries.sex);
    hr = Risk.multipliers(riskModel, state.survey, riskSex(entries.sex));
  }

  // The backend calculates point 0 for exactly this moment (ms), so the
  // countdown starts from the right value. POST keeps values out of URLs/logs.
  const params = {
    country: entries.country,
    birthDate: entries.birthDate,
    sex: entries.sex,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    now: Date.now(),
  };
  if (hr) {
    params.hr65 = hr.hr65;
    params.hr85 = hr.hr85;
  }
  const data = await api("life_expectancy_timeline.php", params, { method: "POST", cache: "no-store" });
  state.timeline = data.timeline.map((p) => ({ t: p.atMs, rem: p.remainingSeconds }));
  state.dataYear = data.dataYear;

  const p0 = data.timeline[0];
  state.result = hr ? {
    riskModel,
    model: data.model,
    age: p0.exactAge,
    t0: p0.atMs,
    effectYears: (p0.remainingSeconds - p0.baselineRemainingSeconds) / SECONDS_PER_YEAR,
  } : null;
}

/**
 * Remaining seconds at time `now` (ms), interpolated linearly between
 * timeline points. The countdown speed is constant within one segment
 * (between two 1st-of-month points) and changes at each point, so the
 * displayed value hits every value returned by the service exactly.
 */
function remainingAt(now) {
  const pts = state.timeline;
  let i = 0;
  while (i < pts.length - 2 && now >= pts[i + 1].t) i++;
  const a = pts[i], b = pts[i + 1];
  const rate = (a.rem - b.rem) / ((b.t - a.t) / 1000); // seconds of lifespan per real second
  return Math.max(0, a.rem - rate * ((now - a.t) / 1000));
}

let lastShown = null;

function renderTimer(force) {
  const now = Date.now();
  const total = Math.floor(remainingAt(now));
  if (!force && total === lastShown) return;
  lastShown = total;

  const years = Math.floor(total / SECONDS_PER_YEAR);
  let rest = total - years * SECONDS_PER_YEAR;
  const days = Math.floor(rest / SECONDS_PER_DAY);
  rest -= days * SECONDS_PER_DAY;
  const h = Math.floor(rest / 3600), m = Math.floor((rest % 3600) / 60), s = rest % 60;

  $("t-years").textContent = years;
  $("t-years-word").textContent = t("years", years);
  $("t-days").textContent = days;
  $("t-days-word").textContent = t("days", days);
  $("t-time").textContent = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  $("timer").setAttribute("aria-label", `${years} ${t("years", years)} ${days} ${t("days", days)} ${pad2(h)}:${pad2(m)}:${pad2(s)}`);

  $("d-end").textContent = formatDate(new Date(now + total * 1000));

  // Past the last month in the timeline: get a fresh one.
  if (now >= state.timeline[state.timeline.length - 1].t && !state.refetching) {
    state.refetching = true;
    fetchTimeline(state.entries)
      .then(() => showError($("timer-error"), ""))
      .catch((e) => showError($("timer-error"), e.message))
      .finally(() => { state.refetching = false; });
  }
}

function renderDetails() {
  const e = state.entries;
  const c = state.countries.find((x) => x.code === e.country);
  $("d-country").textContent = c ? countryName(c) : e.country;
  $("d-sex").textContent = t(e.sex === "male" ? "male" : e.sex === "female" ? "female" : "notSpecified");
  $("d-birth").textContent = formatDate(e.birthDate);
  $("note").textContent = t("note", state.dataYear) + (state.result ? " " + t("surveyNote") : "");
}

function formatSignedYears(v) {
  const n = new Intl.NumberFormat(state.lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .format(Math.abs(v));
  return (v >= 0.05 ? "+" : v <= -0.05 ? "−" : "±") + n;
}

/** Survey effect, range and per-factor breakdown — all computed on this device. */
function renderSurveySummary() {
  const r = state.result;
  $("open-survey").textContent = t(state.survey ? "surveyEdit" : "surveyButton");
  $("survey-hint").hidden = !!r;
  $("survey-effect").hidden = $("survey-range").hidden = $("survey-breakdown").hidden = !r;
  $("approx-note").hidden = !(r && r.riskModel.approximate && r.riskModel.approximate.length);
  if (!r) return;

  const sex = riskSex(state.entries.sex);
  $("survey-effect").textContent = t("surveyEffect", formatSignedYears(r.effectYears));

  const range = Risk.range(r.riskModel, state.survey, sex, r.model, r.age);
  if (range) {
    const yearOf = (years) => new Date(r.t0 + years * SECONDS_PER_YEAR * 1000).getFullYear();
    $("survey-range").textContent = t("rangeYears", yearOf(range[0]), yearOf(range[1]));
  }

  const list = $("survey-breakdown-list");
  list.replaceChildren();
  Risk.breakdown(r.riskModel, state.survey, sex, r.model, r.age)
    .sort((a, b) => Math.abs(b.years) - Math.abs(a.years))
    .forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${t("factorNames")[item.factor]}: ${formatSignedYears(item.years)} ${t("yearsDecimal")}`;
      list.append(li);
    });
}

function startTimer() {
  stopTimer();
  lastShown = null;
  renderDetails();
  renderSurveySummary();
  renderTimer(true);
  state.timerId = setInterval(() => renderTimer(false), 100);
  $("form-panel").hidden = true;
  $("survey-panel").hidden = true;
  $("timer-panel").hidden = false;
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

// ------------------------------------------------------------
// Form
// ------------------------------------------------------------

function readForm() {
  const country = $("country").value;
  const birthDate = $("birthDate").value;
  const sex = (document.querySelector('input[name="sex"]:checked') || {}).value || "";
  if (!country) return { error: t("errCountry") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > $("birthDate").max || birthDate < $("birthDate").min) {
    return { error: t("errBirthDate") };
  }
  return { entries: { country, birthDate, sex } };
}

function fillForm(e) {
  if (!e) return;
  $("country").value = e.country || "";
  $("birthDate").value = e.birthDate || "";
  const radio = document.querySelector(`input[name="sex"][value="${e.sex || ""}"]`);
  if (radio) radio.checked = true;
}

async function submit(ev) {
  ev.preventDefault();
  const { entries, error } = readForm();
  showError($("form-error"), error);
  if (error) return;

  const button = $("submit");
  button.disabled = true;
  button.textContent = t("calculating");
  try {
    await fetchTimeline(entries);
    state.entries = entries;
    saveStored();
    startTimer();
  } catch (e) {
    showError($("form-error"), e.message);
  } finally {
    button.disabled = false;
    button.textContent = t("calculate");
  }
}

// ------------------------------------------------------------
// Survey form (answers stay on this device)
// ------------------------------------------------------------

function radioValue(name) {
  return (document.querySelector(`input[name="${name}"]:checked`) || {}).value || "";
}

function setRadio(name, value) {
  const el = document.querySelector(`input[name="${name}"][value="${value || ""}"]`);
  if (el) el.checked = true;
}

function numberValue(id) {
  const v = $(id).value.trim().replace(",", ".");
  return v === "" ? null : Number(v);
}

function currentAge() {
  const b = new Date(state.entries.birthDate + "T00:00:00");
  return (Date.now() - b.getTime()) / (SECONDS_PER_YEAR * 1000);
}

function updateBmi() {
  const h = numberValue("heightCm"), w = numberValue("weightKg");
  const ok = h >= 100 && h <= 250 && w >= 25 && w <= 350;
  $("bmi-value").textContent = ok
    ? t("bmiValue", new Intl.NumberFormat(state.lang, { maximumFractionDigits: 1 }).format(w / Math.pow(h / 100, 2)))
    : "";
}

/** Read and validate the survey. Returns { answers } or { error }. */
function readSurvey() {
  const answers = {};
  const invalid = [];
  const mark = (id, bad) => { $(id).setAttribute("aria-invalid", String(bad)); if (bad) invalid.push(id); };
  ["quitAge", "heightCm", "weightKg", "motherAge", "fatherAge"].forEach((id) => mark(id, false));

  const smoking = radioValue("smoking");
  if (smoking === "former") {
    const q = numberValue("quitAge");
    mark("quitAge", !(q >= 5 && q <= currentAge() + 0.5));
    answers.smoking = { status: "former", quitAge: q };
  } else if (smoking) {
    answers.smoking = { status: smoking };
  }

  const h = numberValue("heightCm"), w = numberValue("weightKg");
  if (h !== null || w !== null) {
    mark("heightCm", !(h >= 100 && h <= 250));
    mark("weightKg", !(w >= 25 && w <= 350));
    answers.bmi = { heightCm: h, weightKg: w };
  }

  const activity = radioValue("activity");
  if (activity) answers.activity = { level: activity };
  const alcohol = radioValue("alcohol");
  if (alcohol) answers.alcohol = { level: alcohol };

  const parents = {};
  for (const who of ["mother", "father"]) {
    const status = $(who + "Status").value;
    if (!status) continue;
    const age = numberValue(who + "Age");
    mark(who + "Age", !(age >= 15 && age <= 120));
    parents[who] = { status, age };
  }
  if (Object.keys(parents).length) answers.parents = parents;

  if (invalid.length) {
    $(invalid[0]).focus();
    return { error: t("errSurvey") };
  }
  return { answers: Object.keys(answers).length ? answers : null };
}

function fillSurvey(a) {
  a = a || {};
  setRadio("smoking", a.smoking && a.smoking.status);
  $("quitAge").value = (a.smoking && a.smoking.quitAge) || "";
  $("heightCm").value = (a.bmi && a.bmi.heightCm) || "";
  $("weightKg").value = (a.bmi && a.bmi.weightKg) || "";
  setRadio("activity", a.activity && a.activity.level);
  setRadio("alcohol", a.alcohol && a.alcohol.level);
  for (const who of ["mother", "father"]) {
    const p = a.parents && a.parents[who];
    $(who + "Status").value = (p && p.status) || "";
    $(who + "Age").value = (p && p.age) || "";
  }
  $("remember").checked = state.remember;
  ["quitAge", "heightCm", "weightKg", "motherAge", "fatherAge"].forEach((id) => $(id).removeAttribute("aria-invalid"));
  updateBmi();
}

function openSurvey() {
  stopTimer();
  fillSurvey(state.survey);
  showError($("survey-error"), "");
  $("timer-panel").hidden = true;
  $("survey-panel").hidden = false;
  $("survey-panel").scrollIntoView({ block: "start" });
}

async function applySurvey(ev) {
  ev.preventDefault();
  const { answers, error } = readSurvey();
  showError($("survey-error"), error);
  if (error) return;

  const previous = state.survey;
  state.survey = answers;
  state.remember = $("remember").checked;

  const button = $("survey-apply");
  button.disabled = true;
  button.textContent = t("applying");
  try {
    await fetchTimeline(state.entries);
    saveSurvey();
    saveStored();
    startTimer();
  } catch (e) {
    state.survey = previous;
    showError($("survey-error"), e.message);
  } finally {
    button.disabled = false;
    button.textContent = t("apply");
  }
}

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

async function init() {
  const stored = loadStored();
  state.entries = stored.entries || null;
  state.survey = loadSurvey();
  state.remember = stored.rememberSurvey !== false;

  // Date limits: not in the future, at most 120 years ago (browser's local date).
  const today = new Date();
  const min = new Date(today);
  min.setFullYear(today.getFullYear() - 120);
  $("birthDate").max = isoDate(today);
  $("birthDate").min = isoDate(min);

  $("country").disabled = true;
  // A language picked with the switch wins; otherwise follow the browser.
  setLanguage(TEXT[stored.lang] ? stored.lang : browserLanguage());

  document.querySelectorAll(".lang button").forEach((b) =>
    b.addEventListener("click", () => setLanguage(b.dataset.lang)));
  $("form").addEventListener("submit", submit);
  $("change").addEventListener("click", () => {
    stopTimer();
    showError($("timer-error"), "");
    fillForm(state.entries);
    $("timer-panel").hidden = true;
    $("form-panel").hidden = false;
  });
  $("open-survey").addEventListener("click", openSurvey);
  $("survey-form").addEventListener("submit", applySurvey);
  $("survey-cancel").addEventListener("click", () => startTimer());
  $("survey-clear").addEventListener("click", () => { fillSurvey(null); showError($("survey-error"), ""); });
  $("heightCm").addEventListener("input", updateBmi);
  $("weightKg").addEventListener("input", updateBmi);
  $("quitAge").addEventListener("focus", () => setRadio("smoking", "former"));
  ["mother", "father"].forEach((who) =>
    $(who + "Age").addEventListener("focus", () => { if (!$(who + "Status").value) $(who + "Status").value = "dead"; }));

  try {
    await loadCountries();
  } catch (e) {
    return;
  }
  fillForm(state.entries);

  // Saved entries: go straight to the ticking timer.
  if (state.entries) {
    try {
      await fetchTimeline(state.entries);
      startTimer();
    } catch (e) {
      showError($("form-error"), e.message);
    }
  }
}

init();
