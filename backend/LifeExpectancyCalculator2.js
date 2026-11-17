
"use strict";

const fs = require("fs");

const NMX_INDICATOR = "LIFE_0000000029";

// Adult age range used to fit the mortality models.
const MIN_FIT_AGE = 30;
const MAX_FIT_AGE = 90;

// Numerical integration settings.
const INTEGRATION_STEP = 0.05;

// ------------------------------------------------------------
// Parse WHO age group codes
// ------------------------------------------------------------

function parseAgeGroup(code) {
    if (!code || typeof code !== "string") {
        return null;
    }

    let value = code.replace(/^AGEGROUP_/, "");

    value = value.replace(/^YEARS/, "");

    const match = value.match(/^(\d+)-(\d+)$/);

    if (match) {
        const lower = Number(match[1]);
        const upper = Number(match[2]);

        if (upper < lower) return null;

        return {
            lower,
            upper,
            midpoint: (lower + upper + 1) / 2
        };
    }

    // WHO open-ended age group.
    if (value === "85PLUS") {
        return {
            lower: 85,
            upper: 89,
            midpoint: 87
        };
    }

    return null;
}

// ------------------------------------------------------------
// Normalize sex
// ------------------------------------------------------------

function normalizeSex(value) {
    if (!value) return null;

    const sex = String(value).toUpperCase();

    if (sex === "SEX_MLE" || sex === "MALE" || sex === "M") {
        return "male";
    }

    if (sex === "SEX_FMLE" || sex === "FEMALE" || sex === "F") {
        return "female";
    }

    return null;
}

// ------------------------------------------------------------
// Load WHO nMx records
// ------------------------------------------------------------

function loadRecords(filename) {
    const json = JSON.parse(fs.readFileSync(filename, "utf8"));

    if (!Array.isArray(json)) {
        throw new Error("Expected WHO JSON to contain a top-level array.");
    }

    const records = [];
    let skipped = 0;

    for (const item of json) {
        if (item.IndicatorCode !== NMX_INDICATOR) {
            skipped++;
            continue;
        }

        const country = item.SpatialDim;
        const year = Number(item.TimeDim);
        const sex = normalizeSex(item.Dim1);
        const age = parseAgeGroup(item.Dim2);
        const rate = Number(item.NumericValue);

        if (!country || !Number.isFinite(year) ||
            !sex || !age || !Number.isFinite(rate) || rate <= 0) {
            skipped++;
            continue;
        }

        records.push({
            country,
            year,
            sex,
            age,
            rate
        });
    }

    console.log("WHO nMx records loaded:", records.length);
    console.log("WHO records skipped:", skipped);

    if (records.length === 0) {
        throw new Error(
            "No usable WHO nMx records found. Check the indicator and JSON file."
        );
    }

    return records;
}

// ------------------------------------------------------------
// Linear regression
// ------------------------------------------------------------

function linearRegression(points) {
    const n = points.length;

    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;

    for (const p of points) {
        sumX += p.x;
        sumY += p.y;
        sumXX += p.x * p.x;
        sumXY += p.x * p.y;
    }

    const denominator = n * sumXX - sumX * sumX;

    if (Math.abs(denominator) < 1e-15) {
        return null;
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return { intercept, slope };
}

// ------------------------------------------------------------
// Evaluate model error in log mortality rates
// ------------------------------------------------------------

function calculateSSE(points, A, B, C) {
    let sse = 0;

    for (const p of points) {
        const predicted = A * Math.exp(B * p.x) + C;

        if (!(predicted > 0) || !Number.isFinite(predicted)) {
            return Infinity;
        }

        const residual = Math.log(p.y) - Math.log(predicted);
        sse += residual * residual;
    }

    return sse;
}

// ------------------------------------------------------------
// Fit Gompertz model:
// mu(x) = A * exp(B*x)
// ------------------------------------------------------------

function fitGompertz(points) {
    const regression = linearRegression(
        points.map(p => ({
            x: p.x,
            y: Math.log(p.y)
        }))
    );

    if (!regression || regression.slope <= 0) {
        return null;
    }

    const A = Math.exp(regression.intercept);
    const B = regression.slope;
    const C = 0;

    const sse = calculateSSE(points, A, B, C);

    return {
        name: "Gompertz",
        A,
        B,
        C,
        sse,
        aic: points.length * Math.log(sse / points.length)
            + 2 * 2,
        observations: points.length
    };
}

// ------------------------------------------------------------
// Fit Gompertz-Makeham model:
// mu(x) = A * exp(B*x) + C
//
// Search over possible C values. For each C, fit the
// Gompertz portion using log(rate - C).
// ------------------------------------------------------------

function fitGompertzMakeham(points) {
    const minRate = Math.min(...points.map(p => p.y));

    let best = null;

    // C must be nonnegative and smaller than every observed rate.
    const maxC = minRate * 0.95;

    const GRID_SIZE = 300;

    for (let i = 0; i <= GRID_SIZE; i++) {
        const C = maxC * i / GRID_SIZE;

        const adjusted = [];

        let valid = true;

        for (const p of points) {
            const remaining = p.y - C;

            if (remaining <= 0) {
                valid = false;
                break;
            }

            adjusted.push({
                x: p.x,
                y: Math.log(remaining)
            });
        }

        if (!valid) continue;

        const regression = linearRegression(adjusted);

        if (!regression || regression.slope <= 0) continue;

        const A = Math.exp(regression.intercept);
        const B = regression.slope;

        if (!Number.isFinite(A) || !Number.isFinite(B)) continue;

        const sse = calculateSSE(points, A, B, C);

        if (!Number.isFinite(sse) || sse <= 0) continue;

        const aic = points.length * Math.log(sse / points.length)
            + 2 * 3;

        if (!best || aic < best.aic) {
            best = {
                name: "Gompertz-Makeham",
                A,
                B,
                C,
                sse,
                aic,
                observations: points.length
            };
        }
    }

    return best;
}

// ------------------------------------------------------------
// Select best model using AIC
// ------------------------------------------------------------

function fitBestModel(records, country, sex, year) {
    const points = records
        .filter(r =>
            r.country.toUpperCase() === country.toUpperCase() &&
            r.sex === sex &&
            r.year === year &&
            r.age.midpoint >= MIN_FIT_AGE &&
            r.age.midpoint <= MAX_FIT_AGE
        )
        .map(r => ({
            x: r.age.midpoint,
            y: r.rate
        }))
        .sort((a, b) => a.x - b.x);

    if (points.length < 5) {
        throw new Error(
            `Not enough adult mortality observations for ${country}, ${sex}, ${year}. Found: ${points.length}`
        );
    }

    const gompertz = fitGompertz(points);
    const makeham = fitGompertzMakeham(points);

    const candidates = [gompertz, makeham].filter(Boolean);

    if (candidates.length === 0) {
        throw new Error("Unable to fit either mortality model.");
    }

    candidates.sort((a, b) => a.aic - b.aic);

    return candidates[0];
}

// ------------------------------------------------------------
// Cumulative hazard from age x to age x+t
//
// H(t) = C*t +
//        (A/B)*exp(B*x)*(exp(B*t)-1)
// ------------------------------------------------------------

function cumulativeHazard(model, age, t) {
    const { A, B, C } = model;

    if (Math.abs(B) < 1e-12) {
        return (A * Math.exp(B * age) + C) * t;
    }

    return C * t +
        (A / B) * Math.exp(B * age) * Math.expm1(B * t);
}

// ------------------------------------------------------------
// Survival probability
// ------------------------------------------------------------

function survivalProbability(model, age, t) {
    const hazard = cumulativeHazard(model, age, t);

    if (hazard > 700) return 0;

    return Math.exp(-hazard);
}

// ------------------------------------------------------------
// Expected remaining lifespan
//
// e(x) = integral from 0 to infinity of S(t) dt
//
// Numerical trapezoidal integration.
// ------------------------------------------------------------

function expectedRemainingLife(model, age) {
    if (!Number.isFinite(age) || age < 0) {
        throw new Error("Age must be a nonnegative number.");
    }

    let total = 0;
    let previous = survivalProbability(model, age, 0);

    const MAX_YEARS = 120;

    for (let t = INTEGRATION_STEP;
         t <= MAX_YEARS;
         t += INTEGRATION_STEP) {

        const current = survivalProbability(model, age, t);

        total += (previous + current) *
            INTEGRATION_STEP / 2;

        previous = current;

        if (current < 1e-12) break;
    }

    return total;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

function main() {
    const args = process.argv.slice(2);

    if (args.length < 3 || args.length > 4) {
        console.log(
            "Usage: node LifeExpectancyCalculator2.js <nMx.json> <country> <male|female> <age> [year]"
        );
        console.log(
            "Example: node LifeExpectancyCalculator2.js life_expectancy_data/who/data/nMx.json POL male 45 2019"
        );
        process.exit(1);
    }

    const filename = args[0];
    const country = args[1];
    const sex = normalizeSex(args[2]);
    const age = Number(args[3]);

    if (!sex) {
        throw new Error("Sex must be male or female.");
    }

    if (!Number.isFinite(age) || age < 0) {
        throw new Error("Age must be a nonnegative number.");
    }

    const records = loadRecords(filename);

    // If no year is specified, use the latest year available
    // for this country and sex.
    const availableYears = records
        .filter(r =>
            r.country.toUpperCase() === country.toUpperCase() &&
            r.sex === sex
        )
        .map(r => r.year);

    if (availableYears.length === 0) {
        throw new Error(
            `No data found for country ${country} and sex ${sex}.`
        );
    }

    const year = args.length === 5
        ? Number(args[4])
        : Math.max(...availableYears);

    if (!availableYears.includes(year)) {
        throw new Error(
            `No WHO mortality data found for ${country}, ${sex}, ${year}.`
        );
    }

    const model = fitBestModel(records, country, sex, year);

    const remaining = expectedRemainingLife(model, age);
    const expectedAgeAtDeath = age + remaining;

    console.log("");
    console.log("======================================");
    console.log("LIFE EXPECTANCY MODEL");
    console.log("======================================");
    console.log("Country:", country.toUpperCase());
    console.log("Sex:", sex);
    console.log("Year:", year);
    console.log("Current age:", age);
    console.log("");
    console.log("Selected model:", model.name);
    console.log("Observations:", model.observations);
    console.log("A:", model.A.toExponential(8));
    console.log("B:", model.B.toFixed(8));
    console.log("C:", model.C.toExponential(8));
    console.log("AIC:", model.aic.toFixed(4));
    console.log("");
    console.log(
        "Expected remaining lifespan:",
        remaining.toFixed(2),
        "years"
    );
    console.log(
        "Expected age at death:",
        expectedAgeAtDeath.toFixed(2),
        "years"
    );
    console.log("======================================");
    console.log("");
    console.log(
        "NOTE: This is a period estimate. It assumes the selected year's"
    );
    console.log(
        "adult mortality pattern continues into the future."
    );
    console.log(
        "The Gompertz models are fitted to adult ages 30-90."
    );
}

try {
    main();
} catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
}
