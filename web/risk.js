/*
 * Survey risk calculation — runs ONLY on the user's device.
 *
 * Survey answers never leave this file's caller: they are turned into two
 * anonymous death-rate multipliers (hr65, hr85) that are sent to the backend.
 * The per-factor breakdown and the result range are also computed here.
 *
 * Factor values and rules come from the backend (risk_model.php, which serves
 * backend/data/risk_factors.json plus WHO prevalence for the country and sex).
 *
 * Works in the browser (window.Risk) and in Node (module.exports) for tests.
 */
(function (root) {
  "use strict";

  const STEP = 0.05;      // integration step in years (same as backend)
  const MAX_YEARS = 120;

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function interpolate(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
      const [x1, y1] = table[i];
      const [x0, y0] = table[i - 1];
      if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return table[table.length - 1][1];
  }

  function sexKey(sex) {
    return sex === "male" || sex === "female" ? sex : "both";
  }

  function prevalenceValue(model, name) {
    const v = model.prevalence && model.prevalence[name];
    return typeof v === "number" ? v : null;
  }

  // ------------------------------------------------------------
  // Factors. Each returns { hr, mean } — the person's hazard ratio and the
  // population average hazard ratio vs the same reference group — or null
  // when the question was skipped.
  // ------------------------------------------------------------

  const FACTORS = {
    smoking(ans, f, sex, model) {
      if (!ans || !ans.status) return null;
      const hrCur = f.hrCurrent[sexKey(sex)];
      const formerHr = (excess) => 1 + (hrCur - 1) * excess;
      let hr;
      if (ans.status === "never") hr = 1;
      else if (ans.status === "current") hr = hrCur;
      else if (ans.status === "former") {
        if (!(ans.quitAge > 0)) return null;
        hr = formerHr(interpolate(f.formerExcessByQuitAge, ans.quitAge));
      } else return null;

      const p = prevalenceValue(model, "smoking_current");
      const pf = Math.min(p * f.assumedFormerShareOfCurrent, 1 - p);
      const mean = (1 - p - pf) * 1 + p * hrCur + pf * formerHr(f.assumedFormerExcess);
      return { hr, mean };
    },

    bmi(ans, f, sex, model) {
      if (!ans || !(ans.heightCm > 0) || !(ans.weightKg > 0)) return null;
      const bmi = ans.weightKg / Math.pow(ans.heightCm / 100, 2);
      if (bmi < f.minBmi || bmi > f.maxBmi) return null;
      const hrOf = (b) => {
        if (b < f.refLow) return 1 + f.lowSlopePerUnit * (f.refLow - b);
        if (b <= f.refHigh) return 1;
        return Math.pow(f.hrPer5Above, (b - f.refHigh) / 5);
      };
      const pOw = prevalenceValue(model, "overweight");
      const pOb = Math.min(prevalenceValue(model, "obesity"), pOw);
      const mean = (1 - pOw) * hrOf(f.assumedBmi.normal)
        + (pOw - pOb) * hrOf(f.assumedBmi.overweight)
        + pOb * hrOf(f.assumedBmi.obese);
      return { hr: hrOf(bmi), mean, bmi };
    },

    activity(ans, f, sex, model) {
      if (!ans || !(ans.level in f.levels)) return null;
      const L = f.levels, s = f.assumedSplit;
      const pIn = prevalenceValue(model, "insufficient_activity");
      const meanIn = s.insufficient.none * L.none + s.insufficient.low * L.low;
      const meanOk = s.sufficient.guideline * L.guideline + s.sufficient.double * L.double + s.sufficient.high * L.high;
      return { hr: L[ans.level], mean: pIn * meanIn + (1 - pIn) * meanOk };
    },

    alcohol(ans, f, sex, model) {
      if (!ans || !(ans.level in f.levels)) return null;
      const L = f.levels, b = f.gramsPerWeekBounds;
      const a = prevalenceValue(model, "alcohol_abstainers");
      const litres = prevalenceValue(model, "alcohol_litres");
      // Average grams/week among drinkers; exponential distribution of intake.
      const gramsPerWeek = litres * f.gramsPerLitre / 52.18;
      const m = Math.max(gramsPerWeek / Math.max(1 - a, 0.05), 1);
      const below = (x) => 1 - Math.exp(-x / m);
      const shares = {
        light: below(b.light),
        moderate: below(b.moderate) - below(b.light),
        heavy: below(b.heavy) - below(b.moderate),
        veryHeavy: 1 - below(b.heavy),
      };
      let meanDrinkers = 0;
      for (const k in shares) meanDrinkers += shares[k] * L[k];
      return { hr: L[ans.level], mean: a * L.none + (1 - a) * meanDrinkers };
    },

    parents(ans, f) {
      if (!ans) return null;
      let ln = 0, known = 0;
      for (const who of ["mother", "father"]) {
        const p = ans[who];
        if (!p || !(p.age > 0) || (p.status !== "alive" && p.status !== "dead")) continue;
        // A living parent's age is a minimum: it can only raise the estimate.
        const age = p.status === "alive" ? Math.max(p.age, f.referenceAge) : Math.max(p.age, f.minAgeCounted);
        ln += ((age - f.referenceAge) / 10) * Math.log(f.hrPerDecade[who]);
        known++;
      }
      if (!known) return null;
      // Already relative to an average parent: mean = 1.
      return { hr: Math.exp(ln), mean: 1 };
    },
  };

  // ------------------------------------------------------------
  // Combination
  // ------------------------------------------------------------

  /**
   * Per-factor log multipliers relative to the national average.
   * Returns { factorName: { lnR, hr, mean } } for answered factors only.
   */
  function factorEffects(riskModel, answers, sex) {
    const out = {};
    for (const name in FACTORS) {
      const f = riskModel.factors[name];
      if (!f) continue;
      const r = FACTORS[name](answers ? answers[name] : null, f, sex, riskModel);
      if (!r || !(r.hr > 0) || !(r.mean > 0)) continue;
      out[name] = { lnR: Math.log(r.hr / r.mean), hr: r.hr, mean: r.mean };
    }
    return out;
  }

  /**
   * Combine effects into the two multipliers sent to the backend.
   * `scale` widens/narrows all effects (used for the result range).
   * `skip` leaves one factor out (used for the per-factor breakdown).
   */
  function combine(riskModel, effects, scale = 1, skip = null) {
    let ln65 = 0, ln85 = 0;
    for (const name in effects) {
      if (name === skip) continue;
      const f = riskModel.factors[name];
      const w = riskModel.groupWeights[f.group] ?? 1;
      ln65 += w * effects[name].lnR;
      ln85 += w * f.oldRatio * effects[name].lnR;
    }
    const lo = Math.log(riskModel.limits.minHr), hi = Math.log(riskModel.limits.maxHr);
    const clamp = (v) => Math.min(hi, Math.max(lo, v * scale));
    return { hr65: Math.exp(clamp(ln65)), hr85: Math.exp(clamp(ln85)) };
  }

  function roundHr(riskModel, hr) {
    const step = riskModel.limits.roundTo || 0.01;
    return Math.round(hr / step) * step;
  }

  /**
   * Main entry: answers -> { hr65, hr85 } (rounded) or null if nothing answered.
   */
  function multipliers(riskModel, answers, sex) {
    const effects = factorEffects(riskModel, answers, sex);
    if (!Object.keys(effects).length) return null;
    const { hr65, hr85 } = combine(riskModel, effects);
    return {
      hr65: Number(roundHr(riskModel, hr65).toFixed(2)),
      hr85: Number(roundHr(riskModel, hr85).toFixed(2)),
    };
  }

  // ------------------------------------------------------------
  // Mortality model with multiplier (same math as backend lib/mortality.php)
  // ------------------------------------------------------------

  function segmentHazard(m, u, v, ra, k, xa) {
    if (v <= u) return 0;
    const bk = m.B + k;
    const base = m.A * ra * Math.exp(m.B * u + k * (u - xa));
    const aPart = Math.abs(bk) < 1e-12 ? base * (v - u) : base * Math.expm1(bk * (v - u)) / bk;
    const cPart = Math.abs(k) < 1e-12
      ? m.C * ra * (v - u)
      : m.C * ra * Math.exp(k * (u - xa)) * Math.expm1(k * (v - u)) / k;
    return aPart + cPart;
  }

  function cumulativeHazard(m, age, t, hr65, hr85, a, b) {
    const x1 = age + t;
    const k = Math.log(hr85 / hr65) / (b - a);
    return segmentHazard(m, age, Math.min(x1, a), hr65, 0, a)
      + segmentHazard(m, Math.max(age, a), Math.min(x1, b), hr65, k, a)
      + segmentHazard(m, Math.max(age, b), x1, hr85, 0, b);
  }

  /** Expected remaining years at `age` for model {A,B,C} and multipliers. */
  function remainingYears(m, age, hr65 = 1, hr85 = 1, profile = { fullUntil: 65, oldFrom: 85 }) {
    let total = 0, prev = 1;
    for (let t = STEP; t <= MAX_YEARS; t += STEP) {
      const h = cumulativeHazard(m, age, t, hr65, hr85, profile.fullUntil, profile.oldFrom);
      const cur = h > 700 ? 0 : Math.exp(-h);
      total += (prev + cur) * STEP / 2;
      prev = cur;
      if (cur < 1e-12) break;
    }
    return total;
  }

  /**
   * Per-factor effect in years at `age`: full result minus the result with
   * that one factor set back to the national average. Positive = adds years.
   */
  function breakdown(riskModel, answers, sex, m, age) {
    const effects = factorEffects(riskModel, answers, sex);
    const full = combine(riskModel, effects);
    const fullYears = remainingYears(m, age, full.hr65, full.hr85, riskModel.ageProfile);
    const items = [];
    for (const name in effects) {
      const w = combine(riskModel, effects, 1, name);
      items.push({ factor: name, years: fullYears - remainingYears(m, age, w.hr65, w.hr85, riskModel.ageProfile) });
    }
    return items;
  }

  /** Range of remaining years: all effects scaled by rangeScale (e.g. 0.75 and 1.25). */
  function range(riskModel, answers, sex, m, age) {
    const effects = factorEffects(riskModel, answers, sex);
    if (!Object.keys(effects).length) return null;
    const ys = riskModel.rangeScale.map((s) => {
      const c = combine(riskModel, effects, s);
      return remainingYears(m, age, c.hr65, c.hr85, riskModel.ageProfile);
    });
    return [Math.min(...ys), Math.max(...ys)];
  }

  const Risk = { multipliers, factorEffects, combine, remainingYears, breakdown, range, interpolate };

  if (typeof module !== "undefined" && module.exports) module.exports = Risk;
  else root.Risk = Risk;
})(typeof window !== "undefined" ? window : globalThis);
