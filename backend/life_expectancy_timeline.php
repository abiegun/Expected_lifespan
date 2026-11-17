<?php
/**
 * Remaining lifespan timeline from a birth date.
 *
 * GET  life_expectancy_timeline.php?country=POL&birthDate=1980-05-15&sex=male[&tz=Europe/Warsaw]
 * POST life_expectancy_timeline.php   with a JSON body holding the same parameters
 *      (Content-Type: application/json). Use POST when sending hr65/hr85, so the
 *      values do not appear in web server access logs.
 *
 *   country    WHO / ISO alpha-3 code (see countries.php). Required.
 *   birthDate  YYYY-MM-DD. Required; not in the future, at most 120 years ago.
 *   sex        male | female | empty (empty = both sexes).
 *   tz         IANA time zone for birth midnight and month starts. Optional, default UTC.
 *   now        Client's current time, Unix time in milliseconds (e.g. JavaScript Date.now()).
 *              Optional, default server time. Must be within 1 day of the server time.
 *   hr65, hr85 Optional survey risk multipliers (both or neither, each 0.4-6), computed on
 *              the user's device from survey answers that never leave the device.
 *              hr65 multiplies the death rate up to age 65, hr85 from age 85; ln(hr) is
 *              interpolated linearly in between. Without them the result is the baseline.
 *
 * Returns remaining lifespan for 13 points in time:
 *   [0]      "now" (the given time, to the millisecond)
 *   [1..12]  00:00 on the 1st day of each of the next 12 months
 *
 * Each point: date, at (Unix seconds, fractional for point 0), atMs (Unix milliseconds),
 * exactAge, remainingSeconds (fractional, millisecond precision), remaining
 * (years / days / hh:mm:ss, whole seconds) and expectedEndAt (= at + remainingSeconds).
 *
 * With hr65/hr85, each point also has baselineRemainingSeconds (without the survey),
 * and the response has riskMultiplier {hr65, hr85}. "model" is always the baseline model.
 *
 * The response must not be cached (it depends on the current time).
 *
 * expectedEndAt moves slightly later from point to point: surviving another
 * month raises the expected age at death a little. A client can interpolate
 * remainingSeconds between consecutive points.
 */

declare(strict_types=1);

require __DIR__ . '/lib/mortality.php';
require __DIR__ . '/lib/data.php';

const MAX_AGE_YEARS = 120;
const MONTHS_AHEAD = 12;
const MAX_CLOCK_DIFF_SECONDS = 86400;

api_start(0); // result depends on the current time: never cache

// ---- Parameters ----------------------------------------------------------

$params = request_params();

$tzParam = param($params, 'tz');
try {
    $tz = new DateTimeZone($tzParam === '' ? 'UTC' : $tzParam);
} catch (Throwable $e) {
    fail('Parameter "tz" must be a valid time zone, e.g. Europe/Warsaw.');
}

$birthParam = param($params, 'birthDate');
$birth = DateTimeImmutable::createFromFormat('!Y-m-d', $birthParam, $tz);
$errors = DateTimeImmutable::getLastErrors();
if ($birth === false || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthParam)
    || ($errors && ($errors['warning_count'] || $errors['error_count']))) {
    fail('Parameter "birthDate" is required in format YYYY-MM-DD and must be a real date.');
}

$nowParam = param($params, 'now');
if ($nowParam === '') {
    $nowMs = (int)floor(microtime(true) * 1000);
} else {
    if (!preg_match('/^\d{1,15}(\.\d+)?$/', $nowParam)) {
        fail('Parameter "now" must be Unix time in milliseconds.');
    }
    $nowMs = (int)floor((float)$nowParam);
    if (abs($nowMs / 1000 - microtime(true)) > MAX_CLOCK_DIFF_SECONDS) {
        fail('Parameter "now" differs from the server time by more than 1 day. Check the device clock.');
    }
}
$now = DateTimeImmutable::createFromFormat('U.u', sprintf('%d.%03d000', intdiv($nowMs, 1000), $nowMs % 1000))
    ->setTimezone($tz);
if ($birth > $now) {
    fail('Parameter "birthDate" cannot be in the future.');
}
if ($birth < $now->modify('-' . MAX_AGE_YEARS . ' years')) {
    fail('Parameter "birthDate" cannot be more than ' . MAX_AGE_YEARS . ' years ago.');
}

// Survey risk multipliers (optional, both or neither).
$hr = null;
$hr65Param = param($params, 'hr65');
$hr85Param = param($params, 'hr85');
if ($hr65Param !== '' || $hr85Param !== '') {
    if (!is_numeric($hr65Param) || !is_numeric($hr85Param)) {
        fail('Parameters "hr65" and "hr85" must both be numbers (or both omitted).');
    }
    $hr = [(float)$hr65Param, (float)$hr85Param];
    foreach ($hr as $v) {
        if ($v < MORTALITY_HR_MIN || $v > MORTALITY_HR_MAX) {
            fail(sprintf('Parameters "hr65" and "hr85" must be between %.1f and %.1f.', MORTALITY_HR_MIN, MORTALITY_HR_MAX));
        }
    }
}

$data = load_data();
[$countryCode, $country, $sex, $series, $model] =
    resolve_model($data, param($params, 'country'), param($params, 'sex'));

// ---- Points in time ------------------------------------------------------

$points = [$now];
$monthStart = $now->modify('first day of next month')->setTime(0, 0, 0);
for ($i = 0; $i < MONTHS_AHEAD; $i++) {
    $points[] = $monthStart->modify("+$i months");
}

$birthMs = $birth->getTimestamp() * 1000;
$timeline = [];

foreach ($points as $i => $point) {
    $atMs = $i === 0 ? $nowMs : $point->getTimestamp() * 1000;
    $exactAge = ($atMs - $birthMs) / 1000 / SECONDS_PER_YEAR;
    $remainingYears = mortality_expected_remaining_life_hr($model, $exactAge, $hr);
    $remainingSeconds = round($remainingYears * SECONDS_PER_YEAR, 3);

    $item = [
        'date' => $i === 0 ? $point->format('Y-m-d\TH:i:s.vP') : $point->format('Y-m-d'),
        'at' => $i === 0 ? $atMs / 1000 : intdiv($atMs, 1000),
        'atMs' => $atMs,
        'exactAge' => round($exactAge, 9),
        'remainingSeconds' => $remainingSeconds,
        'remaining' => format_duration((int)floor($remainingSeconds)),
        'expectedEndAt' => round($atMs / 1000 + $remainingSeconds, 3),
    ];
    if ($hr !== null) {
        $item['baselineRemainingSeconds'] =
            round(mortality_expected_remaining_life($model, $exactAge) * SECONDS_PER_YEAR, 3);
    }
    $timeline[] = $item;
}

$response = [
    'country' => $countryCode,
    'countryName' => $country['name'],
    'sex' => $sex,
    'birthDate' => $birth->format('Y-m-d'),
    'timeZone' => $tz->getName(),
    'dataYear' => $series['year'],
    'expectedEndDate' => (new DateTimeImmutable('@' . (int)floor($timeline[0]['expectedEndAt'])))
        ->setTimezone($tz)->format(DATE_ATOM),
    'timeline' => $timeline,
    'model' => [
        'name' => $model['name'],
        'A' => $model['A'],
        'B' => $model['B'],
        'C' => $model['C'],
        'aic' => round($model['aic'], 4),
        'observations' => $model['observations'],
    ],
];
if ($hr !== null) {
    $response['riskMultiplier'] = ['hr65' => $hr[0], 'hr85' => $hr[1]];
}
respond($response);
