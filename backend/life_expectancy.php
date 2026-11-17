<?php
/**
 * Expected lifespan service.
 *
 * GET life_expectancy.php?country=POL&sex=male&age=45
 *
 *   country  ISO 3166-1 alpha-3 code as used by WHO (POL, DEU, USA, ...). Required.
 *   sex      male | female | empty (empty = both sexes). Also accepts m / f.
 *   age      current age in years, may be fractional (e.g. 45.37). Required, 0-120.
 *
 * Returns JSON. On error: HTTP 400/404/500 with {"error": "..."}.
 *
 * Reads data/nmx_latest.json, produced by prepare_data.php.
 */

declare(strict_types=1);

require __DIR__ . '/lib/mortality.php';
require __DIR__ . '/lib/data.php';

api_start(0); // result depends on the current time: never cache

// ---- Parameters ----------------------------------------------------------

$countryParam = strtoupper(trim((string)($_GET['country'] ?? '')));
$sexParam = (string)($_GET['sex'] ?? '');
$ageParam = trim((string)($_GET['age'] ?? ''));

if (!preg_match('/^[A-Z0-9_]{2,12}$/', $countryParam)) {
    fail('Parameter "country" is required (WHO / ISO alpha-3 code, e.g. POL).');
}
$sex = mortality_normalize_sex($sexParam);
if ($sex === null) {
    fail('Parameter "sex" must be male, female or empty.');
}
if ($ageParam === '' || !is_numeric($ageParam)) {
    fail('Parameter "age" is required and must be a number.');
}
$age = (float)$ageParam;
if ($age < 0 || $age > 120) {
    fail('Parameter "age" must be between 0 and 120.');
}

// ---- Data ----------------------------------------------------------------

$data = load_data();
$country = $data['countries'][$countryParam] ?? null;
if ($country === null) {
    fail("No data for country \"$countryParam\".", 404);
}
$series = $country['sexes'][$sex] ?? null;
if ($series === null) {
    fail("No data for country \"$countryParam\" and sex \"$sex\".", 404);
}

// ---- Calculation ---------------------------------------------------------

try {
    $model = mortality_fit_best_model($series['rates']);
    $remainingYears = mortality_expected_remaining_life($model, $age);
} catch (Throwable $e) {
    fail('Calculation failed: ' . $e->getMessage(), 500);
}

$remainingSeconds = (int)round($remainingYears * DAYS_PER_YEAR * SECONDS_PER_DAY);
$now = time();

respond([
    'country' => $countryParam,
    'countryName' => $country['name'],
    'sex' => $sex,
    'age' => $age,
    'dataYear' => $series['year'],
    'remainingSeconds' => $remainingSeconds,
    'remaining' => format_duration($remainingSeconds),
    'remainingYears' => round($remainingYears, 4),
    'expectedAgeAtDeath' => round($age + $remainingYears, 4),
    'calculatedAt' => $now,
    'expectedEndAt' => $now + $remainingSeconds,
    'model' => [
        'name' => $model['name'],
        'A' => $model['A'],
        'B' => $model['B'],
        'C' => $model['C'],
        'aic' => round($model['aic'], 4),
        'observations' => $model['observations'],
    ],
]);
