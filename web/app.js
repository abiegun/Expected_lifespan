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
    day: "Day",
    month: "Month",
    year: "Year",
    chooseMonth: "—",
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
    factorNames: {
      smoking: "Smoking", bmi: "Body weight (BMI)", activity: "Physical activity", alcohol: "Alcohol", parents: "Parents",
      stroke: "Stroke", heartAttack: "Heart attack", diabetes: "Diabetes", bloodPressure: "Blood pressure",
      mental: "Mental health", diet: "Diet", income: "Income", social: "Living situation and contacts",
      sitting: "Sitting", sleep: "Sleep", education: "Education", air: "Place of residence (air quality)",
    },
    // Extended survey
    moreQuestions: "More questions (optional)",
    moreHint: "Ordered by how much each answer can change the result. Skip anything you like.",
    sectionReminder: "These answers also stay on your device. All questions here are optional.",
    yes: "Yes",
    no: "No",
    dontKnow: "Don't know / prefer not to say",
    qStroke: "Have you had a stroke?",
    qHeartAttack: "Have you had a heart attack?",
    qDiabetes: "Have you been diagnosed with diabetes?",
    qBloodPressure: "Blood pressure",
    bpNormal: "Normal",
    bpControlled: "High – treated and under control",
    bpUncontrolled: "High – treated, but not under control",
    bpUntreated: "High – not treated",
    qMental: "Have you been treated for depression or another mental health condition?",
    mentalNo: "No",
    mentalPast: "Yes, in the past",
    mentalCurrent: "Yes, currently",
    mentalSupport: "If you're going through a hard time, talking to a doctor or someone you trust can help. In Poland: 116 123 (emotional support for adults) or 800 70 2222 (crisis support, 24/7); in an emergency call 112. Other countries: findahelpline.com.",
    qDiet: "Diet",
    dietMode: "Tick what applies to you in most weeks",
    dietFill: "Fill in the checklist",
    dietItems: [
      "Vegetables every day",
      "Fruit every day",
      "Legumes (beans, lentils, peas) at least twice a week",
      "Fish at least twice a week",
      "Mostly wholegrain bread, pasta or cereals",
      "Nuts or seeds at least 3 times a week",
      "Olive or rapeseed oil as the main fat",
      "Red or processed meat at most a few times a week",
      "Sweets and sugary drinks rarely",
    ],
    qIncome: "Household income compared with the average in your country",
    incMuchLower: "Much lower",
    incLower: "Somewhat lower",
    incAverage: "About average",
    incHigher: "Somewhat higher",
    incMuchHigher: "Much higher",
    qSocial: "Living situation and contacts",
    qLivingAlone: "Do you live alone?",
    qContact: "How often do you meet or talk with friends or family?",
    contactDaily: "Every day",
    contactWeekly: "Every week",
    contactMonthly: "Every month",
    contactRarely: "Less often",
    qLonely: "How often do you feel lonely?",
    lonelyNever: "Never or rarely",
    lonelySometimes: "Sometimes",
    lonelyOften: "Often",
    qSitting: "Hours sitting per day (work, TV, travel)",
    sitLt4: "Less than 4",
    sit4to6: "4–6",
    sit6to8: "6–8",
    sitGt8: "More than 8",
    qSleep: "Usual sleep per night",
    sleepLe5: "5 hours or less",
    sleepSix: "About 6 hours",
    sleepSevenEight: "7–8 hours",
    sleepNinePlus: "9 hours or more",
    qEducation: "Highest completed education",
    eduPrimary: "Primary",
    eduVocational: "Vocational",
    eduSecondary: "Secondary",
    eduBachelor: "Bachelor's or engineer's degree",
    eduMaster: "Master's degree or higher",
    qAir: "Where do you live?",
    airCity: "Large city",
    airTown: "Smaller town",
    airCountryside: "Countryside",
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
    day: "Dzień",
    month: "Miesiąc",
    year: "Rok",
    chooseMonth: "—",
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
    factorNames: {
      smoking: "Palenie", bmi: "Masa ciała (BMI)", activity: "Aktywność fizyczna", alcohol: "Alkohol", parents: "Rodzice",
      stroke: "Udar", heartAttack: "Zawał serca", diabetes: "Cukrzyca", bloodPressure: "Ciśnienie tętnicze",
      mental: "Zdrowie psychiczne", diet: "Sposób odżywiania", income: "Dochód", social: "Sytuacja życiowa i kontakty",
      sitting: "Siedzenie", sleep: "Sen", education: "Wykształcenie", air: "Miejsce zamieszkania (jakość powietrza)",
    },
    // Rozszerzona ankieta
    moreQuestions: "Więcej pytań (opcjonalnie)",
    moreHint: "Kolejność według tego, jak bardzo każda odpowiedź może zmienić wynik. Możesz pominąć dowolne pytanie.",
    sectionReminder: "Te odpowiedzi również pozostają na Twoim urządzeniu. Wszystkie pytania są tu opcjonalne.",
    yes: "Tak",
    no: "Nie",
    dontKnow: "Nie wiem / wolę nie odpowiadać",
    qStroke: "Czy przebyłeś(-aś) udar mózgu?",
    qHeartAttack: "Czy przebyłeś(-aś) zawał serca?",
    qDiabetes: "Czy zdiagnozowano u Ciebie cukrzycę?",
    qBloodPressure: "Ciśnienie tętnicze",
    bpNormal: "Prawidłowe",
    bpControlled: "Wysokie – leczone i pod kontrolą",
    bpUncontrolled: "Wysokie – leczone, ale nie pod kontrolą",
    bpUntreated: "Wysokie – nieleczone",
    qMental: "Czy leczyłeś(-aś) się z powodu depresji lub innego zaburzenia psychicznego?",
    mentalNo: "Nie",
    mentalPast: "Tak, w przeszłości",
    mentalCurrent: "Tak, obecnie",
    mentalSupport: "Jeśli przechodzisz trudny okres, rozmowa z lekarzem lub zaufaną osobą może pomóc. Telefon wsparcia emocjonalnego dla dorosłych: 116 123, Centrum Wsparcia (całodobowo): 800 70 2222, w nagłych sytuacjach: 112.",
    qDiet: "Sposób odżywiania",
    dietMode: "Zaznacz, co dotyczy Cię w większość tygodni",
    dietFill: "Wypełnię listę",
    dietItems: [
      "Warzywa codziennie",
      "Owoce codziennie",
      "Rośliny strączkowe (fasola, soczewica, groch) co najmniej 2 razy w tygodniu",
      "Ryby co najmniej 2 razy w tygodniu",
      "Głównie pełnoziarniste pieczywo, makarony lub kasze",
      "Orzechy lub nasiona co najmniej 3 razy w tygodniu",
      "Oliwa lub olej rzepakowy jako główny tłuszcz",
      "Czerwone mięso lub wędliny najwyżej kilka razy w tygodniu",
      "Słodycze i słodzone napoje rzadko",
    ],
    qIncome: "Dochód gospodarstwa domowego w porównaniu ze średnią w kraju",
    incMuchLower: "Znacznie niższy",
    incLower: "Nieco niższy",
    incAverage: "Mniej więcej średni",
    incHigher: "Nieco wyższy",
    incMuchHigher: "Znacznie wyższy",
    qSocial: "Sytuacja życiowa i kontakty",
    qLivingAlone: "Czy mieszkasz sam(a)?",
    qContact: "Jak często spotykasz się lub rozmawiasz z przyjaciółmi lub rodziną?",
    contactDaily: "Codziennie",
    contactWeekly: "Co tydzień",
    contactMonthly: "Co miesiąc",
    contactRarely: "Rzadziej",
    qLonely: "Jak często czujesz się samotny(-a)?",
    lonelyNever: "Nigdy lub rzadko",
    lonelySometimes: "Czasami",
    lonelyOften: "Często",
    qSitting: "Godziny siedzenia dziennie (praca, telewizja, dojazdy)",
    sitLt4: "Mniej niż 4",
    sit4to6: "4–6",
    sit6to8: "6–8",
    sitGt8: "Ponad 8",
    qSleep: "Zwykle sypiasz",
    sleepLe5: "5 godzin lub mniej",
    sleepSix: "Około 6 godzin",
    sleepSevenEight: "7–8 godzin",
    sleepNinePlus: "9 godzin lub więcej",
    qEducation: "Najwyższe ukończone wykształcenie",
    eduPrimary: "Podstawowe",
    eduVocational: "Zasadnicze zawodowe",
    eduSecondary: "Średnie",
    eduBachelor: "Licencjat lub inżynier",
    eduMaster: "Magister lub wyższe",
    qAir: "Gdzie mieszkasz?",
    airCity: "Duże miasto",
    airTown: "Mniejsze miasto",
    airCountryside: "Wieś",
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
  birthMin: "",       // allowed birth dates (YYYY-MM-DD), set in init()
  birthMax: "",
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
  document.querySelectorAll("[data-i18n-item]").forEach((el) => {
    const [key, i] = el.dataset.i18nItem.split(".");
    el.textContent = t(key)[Number(i)];
  });
  document.querySelectorAll(".lang button").forEach((b) => {
    const active = b.dataset.lang === state.lang;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  renderCountryOptions();
  renderMonthOptions();
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
  const usedApprox = r ? Risk.usedPrevalence(r.riskModel, state.survey, riskSex(state.entries.sex))
    .filter((k) => (r.riskModel.approximate || []).includes(k)) : [];
  $("approx-note").hidden = !usedApprox.length;
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
// Birth date: day / month / year fields in the page language.
// Internally the date is always YYYY-MM-DD.
// ------------------------------------------------------------

function renderMonthOptions() {
  const select = $("birthMonth");
  const selected = select.value;
  const fmt = new Intl.DateTimeFormat(state.lang, { month: "long" });
  select.replaceChildren(new Option(t("chooseMonth"), ""));
  for (let m = 1; m <= 12; m++) {
    const name = fmt.format(new Date(2000, m - 1, 1));
    select.add(new Option(name.charAt(0).toUpperCase() + name.slice(1), String(m)));
  }
  select.value = selected;
}

/** "" when all parts are empty, null when invalid, otherwise YYYY-MM-DD. */
function getBirthDate() {
  const d = $("birthDay").value.trim(), m = $("birthMonth").value, y = $("birthYear").value.trim();
  if (!d && !m && !y) return "";
  if (!/^\d{1,2}$/.test(d) || !m || !/^\d{4}$/.test(y)) return null;
  const day = Number(d), month = Number(m), year = Number(y);
  const date = new Date(year, month - 1, day);
  // Rejects dates that do not exist, e.g. 31 February.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return isoDate(date);
}

function setBirthDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  $("birthDay").value = m ? String(Number(m[3])) : "";
  $("birthMonth").value = m ? String(Number(m[2])) : "";
  $("birthYear").value = m ? m[1] : "";
}

function markBirthInvalid(bad) {
  ["birthDay", "birthMonth", "birthYear"].forEach((id) => $(id).setAttribute("aria-invalid", String(bad)));
}

// ------------------------------------------------------------
// Form
// ------------------------------------------------------------

function readForm() {
  const country = $("country").value;
  const birthDate = getBirthDate();
  const sex = (document.querySelector('input[name="sex"]:checked') || {}).value || "";
  markBirthInvalid(false);
  if (!country) return { error: t("errCountry") };
  if (!birthDate || birthDate > state.birthMax || birthDate < state.birthMin) {
    markBirthInvalid(true);
    return { error: t("errBirthDate") };
  }
  return { entries: { country, birthDate, sex } };
}

function fillForm(e) {
  if (!e) return;
  $("country").value = e.country || "";
  setBirthDate(e.birthDate);
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
  readExtended(answers);

  if (invalid.length) {
    $(invalid[0]).focus();
    return { error: t("errSurvey") };
  }
  return { answers: Object.keys(answers).length ? answers : null };
}

// Extended questions. Order comes from the factor table (riskModel.extendedOrder):
// largest possible effect first.
const EXTENDED = {
  stroke: { kind: "yesno", q: "qStroke" },
  heartAttack: { kind: "yesno", q: "qHeartAttack" },
  diabetes: { kind: "yesno", q: "qDiabetes" },
  bloodPressure: { kind: "select", q: "qBloodPressure", skip: "dontKnow",
    options: [["normal", "bpNormal"], ["controlled", "bpControlled"], ["uncontrolled", "bpUncontrolled"], ["untreated", "bpUntreated"]] },
  mental: { kind: "select", q: "qMental", sensitive: true,
    options: [["no", "mentalNo"], ["past", "mentalPast"], ["current", "mentalCurrent"]] },
  diet: { kind: "diet", q: "qDiet" },
  income: { kind: "select", q: "qIncome",
    options: [["muchLower", "incMuchLower"], ["lower", "incLower"], ["average", "incAverage"], ["higher", "incHigher"], ["muchHigher", "incMuchHigher"]] },
  social: { kind: "social", q: "qSocial" },
  sitting: { kind: "select", q: "qSitting",
    options: [["lt4", "sitLt4"], ["4to6", "sit4to6"], ["6to8", "sit6to8"], ["gt8", "sitGt8"]] },
  sleep: { kind: "select", q: "qSleep",
    options: [["le5", "sleepLe5"], ["six", "sleepSix"], ["sevenEight", "sleepSevenEight"], ["ninePlus", "sleepNinePlus"]] },
  education: { kind: "select", q: "qEducation",
    options: [["primary", "eduPrimary"], ["vocational", "eduVocational"], ["secondary", "eduSecondary"], ["bachelor", "eduBachelor"], ["master", "eduMaster"]] },
  air: { kind: "select", q: "qAir", options: [["city", "airCity"], ["town", "airTown"], ["countryside", "airCountryside"]] },
};
const SOCIAL_PARTS = {
  livingAlone: ["qLivingAlone", [["yes", "yes"], ["no", "no"]]],
  contact: ["qContact", [["daily", "contactDaily"], ["weekly", "contactWeekly"], ["monthly", "contactMonthly"], ["rarely", "contactRarely"]]],
  lonely: ["qLonely", [["never", "lonelyNever"], ["sometimes", "lonelySometimes"], ["often", "lonelyOften"]]],
};
const DEFAULT_EXTENDED_ORDER = Object.keys(EXTENDED);

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === "i18n") e.dataset.i18n = attrs[k];
    else if (k === "i18nItem") e.dataset.i18nItem = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  children.forEach((c) => e.append(c));
  return e;
}

function makeSelect(id, options, skipKey = "preferNot") {
  const sel = el("select", { id });
  sel.append(el("option", { value: "", i18n: skipKey }));
  options.forEach(([value, key]) => sel.append(el("option", { value, i18n: key })));
  return sel;
}

/** Build the extended questions once, in the order given by the factor table. */
function renderExtendedQuestions(order) {
  const box = $("extended-questions");
  const key = order.join(",");
  if (box.dataset.order === key) return;
  box.dataset.order = key;
  box.replaceChildren();
  for (const name of order) {
    const q = EXTENDED[name];
    if (!q) continue;
    const wrap = el("div", { class: "xq", id: `xq-${name}` });
    if (q.sensitive) wrap.append(el("p", { class: "reminder", i18n: "sectionReminder" }));
    if (q.kind === "yesno" || q.kind === "select") {
      const opts = q.kind === "yesno" ? [["yes", "yes"], ["no", "no"]] : q.options;
      wrap.append(el("label", { class: "sel" }, [el("span", { i18n: q.q }), makeSelect(`x-${name}`, opts, q.skip)]));
    } else if (q.kind === "diet") {
      wrap.append(el("label", { class: "sel" }, [el("span", { i18n: q.q }),
        makeSelect("x-diet-mode", [["fill", "dietFill"]])]));
      const checks = el("div", { class: "checks", id: "x-diet-items", hidden: "" }, [el("p", { class: "hint", i18n: "dietMode" })]);
      for (let i = 0; i < 9; i++) {
        checks.append(el("label", {}, [el("input", { type: "checkbox", id: `x-diet-${i}` }), el("span", { i18nItem: `dietItems.${i}` })]));
      }
      wrap.append(checks);
    } else if (q.kind === "social") {
      const sub = el("div", { class: "sub" });
      for (const part in SOCIAL_PARTS) {
        const [qKey, opts] = SOCIAL_PARTS[part];
        sub.append(el("label", { class: "sel" }, [el("span", { i18n: qKey }), makeSelect(`x-social-${part}`, opts)]));
      }
      wrap.append(el("p", { class: "q-title", i18n: q.q }), sub);
    }
    if (q.sensitive) wrap.append(el("p", { class: "support", i18n: "mentalSupport" }));
    box.append(wrap);
  }
  $("x-diet-mode").addEventListener("change", () => { $("x-diet-items").hidden = $("x-diet-mode").value !== "fill"; });
  setLanguage(state.lang); // translate the new elements
}

function readExtended(answers) {
  for (const name in EXTENDED) {
    const q = EXTENDED[name];
    if (q.kind === "yesno") {
      const v = $(`x-${name}`).value;
      if (v) answers[name] = { value: v };
    } else if (q.kind === "select") {
      const v = $(`x-${name}`).value;
      if (v) answers[name] = { level: v };
    } else if (q.kind === "diet") {
      if ($("x-diet-mode").value === "fill") {
        const items = [];
        for (let i = 0; i < 9; i++) if ($(`x-diet-${i}`).checked) items.push(i);
        answers.diet = { score: items.length, items };
      }
    } else if (q.kind === "social") {
      const a = {};
      for (const part in SOCIAL_PARTS) {
        const v = $(`x-social-${part}`).value;
        if (v) a[part] = v;
      }
      if (Object.keys(a).length) answers.social = a;
    }
  }
}

function fillExtended(a) {
  let any = false;
  for (const name in EXTENDED) {
    const q = EXTENDED[name], v = a[name];
    if (v) any = true;
    if (q.kind === "yesno") $(`x-${name}`).value = (v && v.value) || "";
    else if (q.kind === "select") $(`x-${name}`).value = (v && v.level) || "";
    else if (q.kind === "diet") {
      $("x-diet-mode").value = v ? "fill" : "";
      $("x-diet-items").hidden = !v;
      // Only the score is stored, so tick the first `score` items.
      for (let i = 0; i < 9; i++) $(`x-diet-${i}`).checked = !!(v && v.items ? v.items.includes(i) : v && i < v.score);
    } else if (q.kind === "social") {
      for (const part in SOCIAL_PARTS) $(`x-social-${part}`).value = (v && v[part]) || "";
    }
  }
  $("survey-more").open = any;
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
  fillExtended(a);
  $("remember").checked = state.remember;
  ["quitAge", "heightCm", "weightKg", "motherAge", "fatherAge"].forEach((id) => $(id).removeAttribute("aria-invalid"));
  updateBmi();
}

async function openSurvey() {
  stopTimer();
  let order = DEFAULT_EXTENDED_ORDER;
  try {
    const rm = await getRiskModel(state.entries.country, state.entries.sex);
    if (Array.isArray(rm.extendedOrder)) order = rm.extendedOrder;
  } catch (e) { /* offline: default order */ }
  renderExtendedQuestions(order);
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
  state.birthMax = isoDate(today);
  state.birthMin = isoDate(min);

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
