<?php
/**
 * Mortality model functions (PHP port of LifeExpectancyCalculator2.js).
 *
 * Fits Gompertz        mu(x) = A * exp(B*x)
 *  and Gompertz-Makeham mu(x) = A * exp(B*x) + C
 * to WHO nMx (age-specific death rates) for adult ages 30-90,
 * picks the model with the lower AIC and integrates the survival
 * curve to obtain expected remaining lifespan.
 */

declare(strict_types=1);

const MORTALITY_MIN_FIT_AGE    = 30;
const MORTALITY_MAX_FIT_AGE    = 90;
const MORTALITY_INTEGRATION_STEP = 0.05;
const MORTALITY_MAX_YEARS      = 120;
const MORTALITY_MAKEHAM_GRID   = 300;

/**
 * Parse WHO age group code, e.g. "AGEGROUP_YEARS55-59", "AGEGROUP_YEARS85PLUS".
 * Returns ['lower'=>int, 'upper'=>int, 'midpoint'=>float] or null.
 */
function mortality_parse_age_group(?string $code): ?array
{
    if ($code === null || $code === '') {
        return null;
    }
    $value = preg_replace('/^AGEGROUP_/', '', $code);
    $value = preg_replace('/^YEARS/', '', $value);

    if (preg_match('/^(\d+)-(\d+)$/', $value, $m)) {
        $lower = (int)$m[1];
        $upper = (int)$m[2];
        if ($upper < $lower) {
            return null;
        }
        return ['lower' => $lower, 'upper' => $upper, 'midpoint' => ($lower + $upper + 1) / 2];
    }
    if ($value === '85PLUS') {
        return ['lower' => 85, 'upper' => 89, 'midpoint' => 87.0];
    }
    return null;
}

/**
 * Normalize sex to 'male' | 'female' | 'both'.
 * Empty / null input means "both sexes". Returns null for unknown values.
 */
function mortality_normalize_sex(?string $value): ?string
{
    $sex = strtoupper(trim((string)$value));
    if ($sex === '' || $sex === 'SEX_BTSX' || $sex === 'BOTH') {
        return 'both';
    }
    if ($sex === 'SEX_MLE' || $sex === 'MALE' || $sex === 'M') {
        return 'male';
    }
    if ($sex === 'SEX_FMLE' || $sex === 'FEMALE' || $sex === 'F') {
        return 'female';
    }
    return null;
}

/** Least-squares line through points [[x,y],...]. */
function mortality_linear_regression(array $points): ?array
{
    $n = count($points);
    $sumX = $sumY = $sumXX = $sumXY = 0.0;
    foreach ($points as [$x, $y]) {
        $sumX += $x;
        $sumY += $y;
        $sumXX += $x * $x;
        $sumXY += $x * $y;
    }
    $den = $n * $sumXX - $sumX * $sumX;
    if (abs($den) < 1e-15) {
        return null;
    }
    $slope = ($n * $sumXY - $sumX * $sumY) / $den;
    $intercept = ($sumY - $slope * $sumX) / $n;
    return ['intercept' => $intercept, 'slope' => $slope];
}

/** Sum of squared errors in log mortality rates. */
function mortality_sse(array $points, float $A, float $B, float $C): float
{
    $sse = 0.0;
    foreach ($points as [$x, $y]) {
        $pred = $A * exp($B * $x) + $C;
        if (!($pred > 0) || !is_finite($pred)) {
            return INF;
        }
        $r = log($y) - log($pred);
        $sse += $r * $r;
    }
    return $sse;
}

function mortality_fit_gompertz(array $points): ?array
{
    $reg = mortality_linear_regression(array_map(fn($p) => [$p[0], log($p[1])], $points));
    if ($reg === null || $reg['slope'] <= 0) {
        return null;
    }
    $A = exp($reg['intercept']);
    $B = $reg['slope'];
    $sse = mortality_sse($points, $A, $B, 0.0);
    $n = count($points);
    return [
        'name' => 'Gompertz', 'A' => $A, 'B' => $B, 'C' => 0.0,
        'sse' => $sse, 'aic' => $n * log($sse / $n) + 2 * 2, 'observations' => $n,
    ];
}

function mortality_fit_gompertz_makeham(array $points): ?array
{
    $minRate = min(array_column($points, 1));
    $maxC = $minRate * 0.95;
    $n = count($points);
    $best = null;

    for ($i = 0; $i <= MORTALITY_MAKEHAM_GRID; $i++) {
        $C = $maxC * $i / MORTALITY_MAKEHAM_GRID;
        $adjusted = [];
        foreach ($points as [$x, $y]) {
            $rem = $y - $C;
            if ($rem <= 0) {
                continue 2;
            }
            $adjusted[] = [$x, log($rem)];
        }
        $reg = mortality_linear_regression($adjusted);
        if ($reg === null || $reg['slope'] <= 0) {
            continue;
        }
        $A = exp($reg['intercept']);
        $B = $reg['slope'];
        if (!is_finite($A) || !is_finite($B)) {
            continue;
        }
        $sse = mortality_sse($points, $A, $B, $C);
        if (!is_finite($sse) || $sse <= 0) {
            continue;
        }
        $aic = $n * log($sse / $n) + 2 * 3;
        if ($best === null || $aic < $best['aic']) {
            $best = [
                'name' => 'Gompertz-Makeham', 'A' => $A, 'B' => $B, 'C' => $C,
                'sse' => $sse, 'aic' => $aic, 'observations' => $n,
            ];
        }
    }
    return $best;
}

/**
 * Fit the best model from rates keyed by age-group midpoint: ['32.5' => 0.0012, ...].
 * @throws RuntimeException
 */
function mortality_fit_best_model(array $ratesByMidpoint): array
{
    $points = [];
    foreach ($ratesByMidpoint as $mid => $rate) {
        $mid = (float)$mid;
        $rate = (float)$rate;
        if ($mid >= MORTALITY_MIN_FIT_AGE && $mid <= MORTALITY_MAX_FIT_AGE && $rate > 0) {
            $points[] = [$mid, $rate];
        }
    }
    usort($points, fn($a, $b) => $a[0] <=> $b[0]);

    if (count($points) < 5) {
        throw new RuntimeException('Not enough adult mortality observations (found ' . count($points) . ').');
    }

    $candidates = array_values(array_filter([
        mortality_fit_gompertz($points),
        mortality_fit_gompertz_makeham($points),
    ]));
    if (!$candidates) {
        throw new RuntimeException('Unable to fit either mortality model.');
    }
    usort($candidates, fn($a, $b) => $a['aic'] <=> $b['aic']);
    return $candidates[0];
}

/** Cumulative hazard from age x to x+t. */
function mortality_cumulative_hazard(array $m, float $age, float $t): float
{
    if (abs($m['B']) < 1e-12) {
        return ($m['A'] * exp($m['B'] * $age) + $m['C']) * $t;
    }
    return $m['C'] * $t + ($m['A'] / $m['B']) * exp($m['B'] * $age) * expm1($m['B'] * $t);
}

function mortality_survival(array $m, float $age, float $t): float
{
    $h = mortality_cumulative_hazard($m, $age, $t);
    return $h > 700 ? 0.0 : exp(-$h);
}

// ---------------------------------------------------------------------------
// Risk multiplier from the survey (computed on the user's device).
//
// The death rate is multiplied by r(x):
//   r(x) = hr65                       for x <= 65
//   r(x) = hr65 * exp(k * (x - 65))   for 65 < x < 85, k = ln(hr85 / hr65) / 20
//   r(x) = hr85                       for x >= 85
// i.e. ln r is interpolated linearly between ages 65 and 85.
// ---------------------------------------------------------------------------

const MORTALITY_HR_AGE_FULL = 65.0;
const MORTALITY_HR_AGE_OLD = 85.0;
const MORTALITY_HR_MIN = 0.4;
const MORTALITY_HR_MAX = 6.0;

/**
 * Integral of r(x) * (A e^{Bx} + C) over [u, v] where r(x) = ra * e^{k (x - xa)}.
 */
function mortality_segment_hazard(array $m, float $u, float $v, float $ra, float $k, float $xa): float
{
    if ($v <= $u) {
        return 0.0;
    }
    $A = $m['A'];
    $B = $m['B'];
    $C = $m['C'];
    $bk = $B + $k;
    // A part: A ra e^{-k xa} * (e^{bk v} - e^{bk u}) / bk  (written with expm1 for precision)
    $aPart = abs($bk) < 1e-12
        ? $A * $ra * exp($B * $u + $k * ($u - $xa)) * ($v - $u)
        : $A * $ra * exp($B * $u + $k * ($u - $xa)) * expm1($bk * ($v - $u)) / $bk;
    // C part: C ra * (e^{k(v-xa)} - e^{k(u-xa)}) / k
    $cPart = abs($k) < 1e-12
        ? $C * $ra * ($v - $u)
        : $C * $ra * exp($k * ($u - $xa)) * expm1($k * ($v - $u)) / $k;
    return $aPart + $cPart;
}

/** Cumulative hazard from age x to x+t with risk multiplier profile [hr65, hr85]. */
function mortality_cumulative_hazard_hr(array $m, float $age, float $t, float $hr65, float $hr85): float
{
    $x0 = $age;
    $x1 = $age + $t;
    $a = MORTALITY_HR_AGE_FULL;
    $b = MORTALITY_HR_AGE_OLD;
    $k = log($hr85 / $hr65) / ($b - $a);

    $h = 0.0;
    // Up to 65: constant hr65.
    $h += mortality_segment_hazard($m, $x0, min($x1, $a), $hr65, 0.0, $a);
    // 65..85: log-linear.
    $h += mortality_segment_hazard($m, max($x0, $a), min($x1, $b), $hr65, $k, $a);
    // From 85: constant hr85.
    $h += mortality_segment_hazard($m, max($x0, $b), $x1, $hr85, 0.0, $b);
    return $h;
}

/**
 * Expected remaining life (years) with an optional risk multiplier profile.
 * With $hr === null this is exactly mortality_expected_remaining_life().
 */
function mortality_expected_remaining_life_hr(array $m, float $age, ?array $hr): float
{
    if ($hr === null) {
        return mortality_expected_remaining_life($m, $age);
    }
    if (!is_finite($age) || $age < 0) {
        throw new InvalidArgumentException('Age must be a nonnegative number.');
    }
    [$hr65, $hr85] = $hr;
    $step = MORTALITY_INTEGRATION_STEP;
    $total = 0.0;
    $prev = 1.0;
    for ($t = $step; $t <= MORTALITY_MAX_YEARS; $t += $step) {
        $h = mortality_cumulative_hazard_hr($m, $age, $t, $hr65, $hr85);
        $cur = $h > 700 ? 0.0 : exp(-$h);
        $total += ($prev + $cur) * $step / 2;
        $prev = $cur;
        if ($cur < 1e-12) {
            break;
        }
    }
    return $total;
}

/** Expected remaining life in years: integral of S(t) dt (trapezoidal rule). */
function mortality_expected_remaining_life(array $m, float $age): float
{
    if (!is_finite($age) || $age < 0) {
        throw new InvalidArgumentException('Age must be a nonnegative number.');
    }
    $step = MORTALITY_INTEGRATION_STEP;
    $total = 0.0;
    $prev = mortality_survival($m, $age, 0.0);
    for ($t = $step; $t <= MORTALITY_MAX_YEARS; $t += $step) {
        $cur = mortality_survival($m, $age, $t);
        $total += ($prev + $cur) * $step / 2;
        $prev = $cur;
        if ($cur < 1e-12) {
            break;
        }
    }
    return $total;
}
