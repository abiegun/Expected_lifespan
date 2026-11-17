# Survey risk factors — effects, sources, questions

Status: **short survey implemented (v1, 2026-11-17)**; detailed survey and medical section not yet. See section 9.

**Decided:** survey answers are confidential and never leave the user's device. The device turns them into two anonymous risk multipliers; only those are sent to the backend (section 1.6).

Purpose: decide which survey questions adjust the expected lifespan, by how much, and on what evidence, before building the short and detailed surveys.

---

## 1. Method

### 1.1 Applying a factor to the model
The backend models the death rate at age *x* as Gompertz–Makeham: `mu(x) = A·e^(B·x) + C`, fitted to WHO nMx for the country and sex.

A factor with hazard ratio *R* (relative to the national average) multiplies the death rate: `A → R·A`, `C → R·C`. Nothing else changes (timeline, interpolation, countdown).

Rule of thumb: with B ≈ 0.09/year, a factor of R = 2 acts like being about ln(2)/B ≈ 7–8 years older.

### 1.2 Relative to the national average, not to the ideal
WHO rates are population averages that already include smokers, obese people etc. Study HRs compare against the *best* group (e.g. never-smokers). Convert:

```
R_person = HR_person / Σ_k ( p_k · HR_k )
```

where `p_k` is the share of the country's population (by sex, ideally by age) in category *k*. Example: if 30% smoke with HR 3 and 70% don't (HR 1), the average is 1.6, so a non-smoker gets R = 1/1.6 = 0.63 and a smoker R = 3/1.6 = 1.9.

Prevalence data needed per country and sex (WHO GHO, same API the download script already uses):
- tobacco use prevalence
- obesity (BMI ≥ 30) and overweight prevalence
- insufficient physical activity prevalence
- alcohol consumption per capita / heavy episodic drinking
- (later) PM2.5 annual mean exposure, diabetes and raised blood pressure prevalence

Where no prevalence is available, the factor is applied relative to a typical European distribution and flagged as approximate.

### 1.3 Age dependence
Relative risks shrink with age. Doll et al. report a smoker/non-smoker death-rate ratio of about 2:1 under 70 and 1.5:1 over 70; education's effect is 2.9% per school year at ages 18–49 but 0.8% at 70+. Each factor gets an age-graded HR: full effect up to ~60–65, tapering towards the older value at 80+.

### 1.4 Combining factors (overlap)
Factors overlap (smokers drink more, education and income work largely through lifestyle, long-lived parents correlate with healthier habits). Plain multiplication overstates the total. Proposal:

1. **Lifestyle core** (smoking, BMI, activity, alcohol, diet): multiply.
2. **Proxy factors** (parents, education, income, social, area): use the HR *adjusted for lifestyle* if the source gives one; otherwise apply only half of the log-effect (`R^0.5`).
3. **Medical conditions**: multiply with each other (ERFC found combinations roughly multiplicative), but cap the combined lifestyle + medical factor.
4. **Global cap**: total R between 0.4 and 6.

Calibration targets (section 6) must be met after combining.

### 1.5 Output
For each answered factor the page/app shows its own effect in years (computed **on the device** by switching that one factor back to the national average). Displayed as "+2.1 years: never smoked", etc. Total result shown as a range (e.g. ±20% of the adjustment) rather than a single exact date.

### 1.6 Where the calculation runs (privacy architecture)

Survey answers are confidential. They are processed **only on the user's device** (browser or Android app). The backend receives at most two numbers that do not say which answers produced them.

```
 Device (web page / Android app)                     Backend (PHP)
 ───────────────────────────────                     ─────────────
 answers ──┐
           │   GET risk_factors.json  ◄───────────── public effect tables (HRs, rules)
           │   GET risk_baseline.php?country&sex ◄── public prevalence (WHO GHO)
           ▼
 combine on device:
   compare with national average (1.2), age profile (1.3),
   overlap + caps (1.4)
           │
           ▼
   hr65, hr85 (rounded to 0.01)
           │   POST life_expectancy_timeline.php  ──► applies multiplier to the
           │   body: {country, birthDate, sex, tz,       country/sex model; returns
           │          now, hr65, hr85}                   baseline + adjusted timeline
           ▼                                             and model (A, B, C);
 per-factor breakdown computed on device                 stores nothing
 from model (A, B, C) — never sent
```

1. **Public tables from the backend.** `risk_factors.json` holds every factor's HRs and rules from this document; `risk_baseline.php?country=POL&sex=male` returns how common each factor is in that country (WHO GHO). Requests contain nothing personal. Web and Android use the same tables, so the factor values live in one place.
2. **Combination on the device.** Produces two multipliers:
   - `hr65` — multiplier of the death rate up to age 65,
   - `hr85` — multiplier from age 85 (usually closer to 1, as relative risks shrink with age).
   The backend interpolates `ln(hr)` linearly between ages 65 and 85. Two numbers keep the age dependence without revealing individual factors.
3. **Backend.** `life_expectancy_timeline.php` accepts `hr65` and `hr85` (each 0.4–6; both or neither). Without them the result is exactly as today. The response contains the baseline (no survey) and the adjusted timeline, so the page can show "the survey adds/removes X years" without a second request.
4. **Per-factor breakdown only on the device**, using the model (A, B, C) already returned by the backend. Per-factor numbers are never sent: they would reveal individual answers.
5. **Not in server logs.** Multipliers are sent in a POST body (JSON), not in the URL, because web servers log full URLs. CORS must allow `POST` and the `Content-Type` header. HTTPS only.
6. **Storage on the device.** Answers are saved only in browser/app storage, with a "don't remember my answers on this device" option. Multipliers are rounded to 0.01.

**Known limitation:** if only one question is answered, the multiplier can hint at that answer (e.g. ≈1.9 with only the smoking question suggests a smoker). The backend stores nothing and the value travels in an HTTPS POST body, so the risk is small; the survey's privacy details say so openly.

---

## 2. Short survey (5 questions)

| # | Factor | Question (EN) | Answers | Effect / HR (vs best group) | Source |
|---|--------|---------------|---------|------------------------------|--------|
| 1 | Smoking | Do you smoke cigarettes? | never · former (age when quit) · current (cigarettes/day) | Current vs never ≈ **3.0** (HR women 3.0, men 2.8, ages 25–79). Former: quit at 25–34 / 35–44 / 45–54 gains ≈ 10 / 9 / 6 years vs continuing; quitting before 40 removes ≈ 90% of excess risk, before 30 > 97%. Quit at 50 halves excess; at 60 gains ≈ 3 years. | Jha et al., NEJM 2013; Pirie et al., Lancet 2013 (Million Women); Doll et al., BMJ 2004 |
| 2 | Body weight | Height (cm) and weight (kg) → BMI | numbers | Lowest mortality at BMI 22.5–25. Above: **×1.29 per +5 BMI** (≈ 2–4 years lost at BMI 30–35, 8–10 years at 40–50). Below 22.5: excess mostly smoking-related → apply only a mild increase below 20. | Prospective Studies Collaboration, Lancet 2009 (894,576 adults) |
| 3 | Physical activity | Minutes per week of moderate (brisk walking, cycling) or vigorous (×2) activity | 0 · <150 · 150–300 · 300–450 · 450+ | vs none: **0.80** below guideline (7.5 MET-h/wk ≈ 150 min moderate), **0.69** at 1–2×, **0.63** at 2–3×, **0.61** plateau at 3–5×; no harm at 10×. Meeting guideline ≈ +3.4 years, half of it ≈ +1.8 years. | Arem et al., JAMA Intern Med 2015; Moore et al., PLoS Med 2012 |
| 4 | Alcohol | Standard drinks per week (1 drink ≈ 10 g alcohol; table of examples) | 0 · 1–10 · 11–20 · 21–35 · 35+ | vs ≤100 g/week: 100–200 g ≈ −0.5 year, 200–350 g ≈ −1 to −2 years, >350 g ≈ −4 to −5 years (life expectancy at 40). HRs to be derived so the model reproduces these losses. Non-drinkers: treated like ≤100 g (no protective J-curve assumed). | Wood et al., Lancet 2018 (599,912 drinkers, 83 studies) |
| 5 | Parents | Age of mother / father at death, or current age if alive; "died of an accident or violence" excluded | ages, "don't know" | All-cause mortality **−16% (mother) / −17% (father) per decade** the parent lived beyond 69. Proxy factor → partly overlaps lifestyle (§1.4). Living parent: use current age as minimum. | Atkins, Pilling et al., JACC 2016 (UK Biobank, 186,151 people aged 55–73) |

Why these five: largest effects, well-established, answerable in about a minute, and (except parents) prevalence data exists per country.

---

## 3. Detailed survey (adds to the short one)

### 3.1 Lifestyle and social

| Factor | Question (EN) | Answers | Effect / HR | Source | Notes |
|--------|---------------|---------|-------------|--------|-------|
| Diet | 9-item Mediterranean-diet checklist (vegetables, fruit, legumes, fish, whole grains, nuts, olive oil, low red/processed meat, low sweets) | score 0–9 | **HR 0.90 per +2 points** of adherence | Soltani et al., Adv Nutr 2019 (29 cohorts, 1.68 M people) | Evidence rated low–moderate; apply with overlap shrink. |
| Sitting | Hours sitting per day (work + TV + travel) | <4 · 4–6 · 6–8 · 8+ | Excess risk of 8+ h/day is eliminated by 60–75 min/day moderate activity; TV ≥ 3 h/day adds risk except at highest activity. | Ekelund et al., Lancet 2016 (>1 M people) | Applied as interaction with Q3; no effect when activity ≥ 60 min/day. Exact HR grid from the paper's figure. |
| Sleep | Usual hours of sleep per night | ≤5 · 6 · 7–8 · 9+ | Short (≤6 h) **1.12**; long (≥9 h) **1.30** vs 7–8 h | Cappuccio et al., Sleep 2010 (1.38 M people) | Long sleep is often a sign of illness → apply at half strength. |
| Social isolation | How often do you meet or talk with friends/family? | daily · weekly · monthly · rarely | Isolation **OR 1.29** | Holt-Lunstad et al., Perspect Psychol Sci 2015 | Proxy, overlap shrink. |
| Living alone | Do you live alone? | yes / no | **OR 1.32** | same | Do not stack fully with isolation: use the larger of the two plus a fraction of the other. |
| Loneliness | How often do you feel lonely? | never · sometimes · often | **OR 1.26** | same | Optional; same stacking rule. |
| Education | Years of schooling (or highest level → years) | number / level | **−1.9% mortality per extra year** (2.9% at 18–49, 0.8% at 70+), relative to country's average years | Balaj et al. (IHME-CHAIN), Lancet Public Health 2024 | Needs country mean years of schooling (UNESCO / World Bank). |
| Income | Household income vs national average | much below · below · around · above · much above | US top 1% vs bottom 1%: 14.6 years (men), 10.1 (women) | Chetty et al., JAMA 2016 | US-only and a very wide gap; gradient in Europe is smaller. **Proposal: small effect only, or leave out.** |
| Air quality | Where do you live? (big city / town / countryside) or region | category | **−0.98 years of life expectancy per +10 µg/m³ PM2.5** sustained exposure | Air Quality Life Index (EPIC, Univ. of Chicago) | Only the difference from the country's average PM2.5 counts. Region-level data later. |
| Mental well-being | Over the last 2 weeks, how often have you felt down or lost interest? (PHQ-2 style) · or: Have you been diagnosed with a mental health condition? | never … nearly every day / yes, no | Diagnosed mental disorders: **RR 2.22**, median 10 years of potential life lost (includes severe disorders) | Walker, McGee, Druss, JAMA Psychiatry 2015 | **Sensitive.** Optional, "prefer not to say", modest effect for screening answers (not 2.22), always shown with a help pointer. |

### 3.2 Medical (optional section)

| Factor | Question (EN) | Effect / HR (all-cause, vs none of these) | Source | Notes |
|--------|---------------|--------------------------------------------|--------|-------|
| Diabetes | Have you been diagnosed with diabetes? | **1.9** | Emerging Risk Factors Collaboration, JAMA 2015 | |
| Stroke | Have you had a stroke? | **2.1** | same | |
| Heart attack | Have you had a heart attack (MI)? | **2.0** | same | |
| Combinations | — | diabetes+MI 3.7, diabetes+stroke 3.8, stroke+MI 3.5, all three 6.9; at age 60, any two ≈ 12 years and all three ≈ 15 years less life expectancy | same | Roughly multiplicative → good calibration check. |
| High blood pressure | Do you have high blood pressure? → treated & controlled / treated not controlled / untreated / don't know | treated but uncontrolled **≈ 1.6** vs normal; controlled ≈ similar to normal | Zhou et al., Sci Rep 2018 (NHANES III) | Single US cohort; look for a meta-analysis before building. |
| COPD, cancer history, kidney disease | — | **not yet sourced** | — | Cancer is too heterogeneous (type, stage, years since) for one question; propose leaving out or "other serious chronic illness" with no effect and a note. |

---

## 4. Not included (for now)

- **Grandparents' age at death.** Heritability of lifespan from pedigree data is estimated well below 10% once assortative mating is accounted for (Ruby et al., Genetics 2018); other analyses argue it is higher. Either way, grandparents add little beyond parents and are often unknown.
- **Income** — see table; US data only.
- **Cancer history, COPD** — need sources and more detailed questions.

---

## 5. Question design rules

- **Confidentiality notice inside each survey** (short and detailed), at the top, before the first question — wording in section 5.1. A one-line reminder is repeated at the top of the mental well-being and medical sections.
- Every question has **"prefer not to say"**; skipped questions use the national average (R = 1).
- Short survey first; detailed survey is optional and extends the short one.
- Show each factor's effect in years after calculation, including positive ones ("+3 years: active").
- Mental health and medical questions: neutral wording, no judgement, and a short line with where to find support.
- Answers stay on the device (browser storage / app storage) and are never sent to the backend; only the two multipliers are (section 1.6). The backend **stores nothing**.
- Results are labelled as a statistical estimate for people with similar answers, not a personal prediction.

### 5.1 Confidentiality notice (shown inside both surveys)

Main notice — top of the short and the detailed survey:

| | Text |
|---|---|
| **EN** | **Your answers stay on this device.** They are used here, on your device, to calculate a single risk multiplier. Only that number is sent to our server — never your answers — and the server does not store it. You can skip any question, and you can choose not to have your answers remembered on this device. |
| **PL** | **Twoje odpowiedzi pozostają na tym urządzeniu.** Służą tutaj, na Twoim urządzeniu, do obliczenia jednego współczynnika ryzyka. Na nasz serwer wysyłana jest tylko ta liczba — nigdy Twoje odpowiedzi — i serwer jej nie zapisuje. Możesz pominąć dowolne pytanie i zdecydować, by odpowiedzi nie były zapamiętywane na tym urządzeniu. |

Expandable "More about privacy" / "Więcej o prywatności":

| | Text |
|---|---|
| **EN** | The number sent to the server combines all your answers, so it does not show which answer caused what. If you answer only one question, the number may hint at that answer. It is sent over an encrypted connection, is not part of the web address, and is not saved on the server. The breakdown of how each answer changes the result is calculated on your device only. |
| **PL** | Liczba wysyłana na serwer łączy wszystkie odpowiedzi, więc nie widać z niej, która odpowiedź za co odpowiada. Jeśli odpowiesz tylko na jedno pytanie, liczba może sugerować tę odpowiedź. Jest wysyłana szyfrowanym połączeniem, nie jest częścią adresu strony i nie jest zapisywana na serwerze. Rozbicie wpływu poszczególnych odpowiedzi na wynik jest liczone wyłącznie na Twoim urządzeniu. |

Section reminder — top of the mental well-being and medical sections:

| | Text |
|---|---|
| **EN** | These answers also stay on your device. All questions here are optional. |
| **PL** | Te odpowiedzi również pozostają na Twoim urządzeniu. Wszystkie pytania są tu opcjonalne. |

Checkbox below the survey: **EN** "Remember my answers on this device" · **PL** "Zapamiętaj moje odpowiedzi na tym urządzeniu" (on by default; when off, answers are cleared after the result is shown).

---

## 6. Calibration checks (tests to pass before release)

| Check | Target (published) |
|-------|--------------------|
| Lifelong smoker vs never-smoker | ≈ 10 years less (Doll 2004; Jha 2013) |
| Quit at 30 / 40 / 50 / 60 vs continuing | ≈ 10 / 9 / 6 / 3 years gained |
| BMI 30–35 vs 22.5–25 | 2–4 years less |
| BMI 40–50 vs 22.5–25 | 8–10 years less |
| Meets activity guideline vs inactive | ≈ +3.4 years; half guideline ≈ +1.8 |
| Alcohol >350 g/week vs ≤100 g | 4–5 years less at age 40 |
| All 5 low-risk lifestyle factors vs none, age 50 | ≈ +12.2 years men, +14.0 years women (Li et al., Circulation 2018) |
| Diabetes + MI at 60 | ≈ 12 years less (ERFC 2015) |
| No answers given | identical to current result |

---

## 7. Open decisions

1. ~~Short survey questions~~ — **decided:** smoking, BMI, activity, alcohol, parents.
2. Include income at all?
3. Mental well-being: screening question, diagnosis question, or leave out?
4. Medical section: diabetes, stroke, MI, blood pressure only for the first version?
5. ~~Range~~ — **decided:** shown under the countdown ("Most likely between 2049 and 2051").
6. ~~Where to compute~~ — **decided:** answers processed on the device; only `hr65` / `hr85` are sent to the backend (section 1.6).

---

## 9. Implementation status (v1)

**Files**
- `backend/data/risk_factors.json` — factor values and rules (version `2026-11-17.1`).
- `backend/risk_model.php?country&sex` — returns the factor table plus national prevalence in one public request (replaces the separate `risk_factors.json` / `risk_baseline.php` of section 1.6; a static JSON file would lack CORS headers). Missing values are filled from `defaultPrevalence` and listed in `approximate`.
- `backend/life_expectancy_timeline.php` — accepts POST JSON and optional `hr65` / `hr85` (0.4–6); returns `baselineRemainingSeconds` per point and `riskMultiplier`. Exact closed-form hazard integration; hr = 1 gives the baseline to the last digit.
- `backend/download_life_expectancy.sh` — downloads WHO prevalence: `M_Est_smk_curr_std`, `NCD_BMI_30A`, `NCD_BMI_25A`, `NCD_PAA`, `SA_0000001688`, `SA_0000001411`.
- `backend/prepare_data.php` — writes `data/prevalence.json` (latest year per country and sex; accepts only total / adult-group records).
- `web/risk.js` — device-side calculation: multipliers, per-factor breakdown, range. To be ported to Kotlin for Android.
- `web/index.html`, `app.js`, `style.css` — survey panel with the section 5.1 notice (EN/PL), summary under the countdown.

**Calibrated values** (differ from the first draft in section 2)
- Smoking: `oldRatio` 0.7 (not 0.6); remaining excess by quit age 30 → 3%, 40 → 8%, 50 → 20%, 60 → 40%, 70 → 60%.
- Alcohol HRs vs ≤100 g/week: 100–200 g 1.06, 200–350 g 1.18, >350 g 1.68.
- Activity `oldRatio` 0.8; other factors 0.6. Parents: reference age 80, proxy weight 0.5.

**Calibration results** (Poland and USA, men and women; tolerance 0.25 years because most targets come from male or pooled cohorts)
- Never vs current smoker at 35: 8.3–10.0 years · quit at 30/40/50/60 vs continuing: ≈ 8.4–9.7 / 7.5–8.2 / 5.7–6.4 / 3.4–3.6.
- BMI 32.5 vs 23.75: 2.8–3.6 · BMI 45: 7.8–9.9 · activity guideline vs none: 3.0–3.8 · half: 1.8–2.3.
- Alcohol >350 g vs ≤100 g at 40: 3.9–4.9 · 4 lifestyle factors best vs poor at 50: 12.9–14.4 (Li 2018: 12.2–14.0 with diet).

**Privacy tests (browser)**: timeline sent by POST; body contains only country, birthDate, sex, tz, now, hr65, hr85; no answer in any URL or body; multipliers never in a URL; server access log shows only the path. "Remember" off removes answers from browser storage.

**Known behaviour**: a very healthy profile can reach the lower limit hr = 0.4 (e.g. 63-year-old Polish man: +7.1 years). Until `download_life_expectancy.sh` and `prepare_data.php` are run, prevalence uses the approximate defaults and the page says so.

---

## 8. Sources

- Doll R, Peto R, Boreham J, Sutherland I. Mortality in relation to smoking: 50 years' observations on male British doctors. BMJ 2004;328:1519. doi:10.1136/bmj.38142.554479.AE
- Jha P et al. 21st-century hazards of smoking and benefits of cessation in the United States. NEJM 2013;368:341–350. doi:10.1056/NEJMsa1211128
- Pirie K et al. The 21st century hazards of smoking and benefits of stopping: a prospective study of one million women in the UK. Lancet 2013. PMC3547248
- Prospective Studies Collaboration. Body-mass index and cause-specific mortality in 900 000 adults. Lancet 2009;373:1083–96. doi:10.1016/S0140-6736(09)60318-4
- Arem H et al. Leisure time physical activity and mortality: a detailed pooled analysis of the dose-response relationship. JAMA Intern Med 2015;175:959–967. doi:10.1001/jamainternmed.2015.0533
- Moore SC et al. Leisure time physical activity of moderate to vigorous intensity and mortality. PLoS Med 2012;9:e1001335. doi:10.1371/journal.pmed.1001335
- Wood AM et al. Risk thresholds for alcohol consumption. Lancet 2018;391:1513–1523. doi:10.1016/S0140-6736(18)30134-X
- Atkins JL, Pilling LC et al. Longer-lived parents and cardiovascular outcomes: 8-year follow-up in 186,000 UK Biobank participants. JACC 2016.
- Li Y et al. Impact of healthy lifestyle factors on life expectancies in the US population. Circulation 2018;138:345–355. doi:10.1161/CIRCULATIONAHA.117.032047
- Soltani S et al. Adherence to the Mediterranean diet in relation to all-cause mortality: dose-response meta-analysis. Adv Nutr 2019;10:1029–1039. doi:10.1093/advances/nmz041
- Ekelund U et al. Does physical activity attenuate, or even eliminate, the detrimental association of sitting time with mortality? Lancet 2016. doi:10.1016/S0140-6736(16)30370-1
- Cappuccio FP et al. Sleep duration and all-cause mortality: systematic review and meta-analysis. Sleep 2010;33:585–592. doi:10.1093/sleep/33.5.585
- Holt-Lunstad J et al. Loneliness and social isolation as risk factors for mortality: a meta-analytic review. Perspect Psychol Sci 2015;10:227–237. doi:10.1177/1745691614568352
- IHME-CHAIN Collaborators (Balaj M et al.). Effects of education on adult mortality: a global systematic review and meta-analysis. Lancet Public Health 2024;9:e155–e165. doi:10.1016/S2468-2667(23)00306-7
- Chetty R et al. The association between income and life expectancy in the United States, 2001–2014. JAMA 2016;315:1750–1766. doi:10.1001/jama.2016.4226
- Air Quality Life Index, Energy Policy Institute at the University of Chicago (EPIC). https://aqli.epic.uchicago.edu
- Walker ER, McGee RE, Druss BG. Mortality in mental disorders and global disease burden implications. JAMA Psychiatry 2015;72:334–341. doi:10.1001/jamapsychiatry.2014.2502
- Emerging Risk Factors Collaboration. Association of cardiometabolic multimorbidity with mortality. JAMA 2015;314:52–60. doi:10.1001/jama.2015.7008
- Zhou D et al. Uncontrolled hypertension increases risk of all-cause and cardiovascular disease mortality in US adults: NHANES III linked mortality study. Sci Rep 2018. doi:10.1038/s41598-018-27377-2
- Ruby JG et al. Estimates of the heritability of human longevity are substantially inflated due to assortative mating. Genetics 2018;210:1109–1124. doi:10.1534/genetics.118.301613
