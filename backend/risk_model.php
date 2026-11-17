<?php
/**
 * Public data for the survey risk calculation done on the user's device.
 *
 * GET risk_model.php?country=POL&sex=male
 *
 *   country  WHO / ISO alpha-3 code (see countries.php). Required.
 *   sex      male | female | empty (empty = both sexes).
 *
 * Returns the factor table (data/risk_factors.json) plus how common each risk
 * factor is in the country (data/prevalence.json, from WHO GHO via
 * prepare_data.php). Missing prevalence values are filled from approximate
 * defaults and listed in "approximate".
 *
 * The request contains nothing personal; survey answers are never sent here.
 */

declare(strict_types=1);

require __DIR__ . '/lib/mortality.php';
require __DIR__ . '/lib/data.php';

const RISK_FACTORS_FILE = __DIR__ . '/data/risk_factors.json';
const PREVALENCE_FILE = __DIR__ . '/data/prevalence.json';

api_start(); // public data: cacheable

$countryCode = strtoupper(param($_GET, 'country'));
if (!preg_match('/^[A-Z0-9_]{2,12}$/', $countryCode)) {
    fail('Parameter "country" is required (WHO / ISO alpha-3 code, e.g. POL).');
}
$sex = mortality_normalize_sex(param($_GET, 'sex'));
if ($sex === null) {
    fail('Parameter "sex" must be male, female or empty.');
}

$data = load_data();
if (!isset($data['countries'][$countryCode])) {
    fail("No data for country \"$countryCode\".", 404);
}

$factors = is_file(RISK_FACTORS_FILE) ? json_decode((string)file_get_contents(RISK_FACTORS_FILE), true) : null;
if (!is_array($factors) || !isset($factors['factors'], $factors['defaultPrevalence'][$sex])) {
    fail('Risk factor table missing or corrupt (data/risk_factors.json).', 500);
}

$prevalenceData = is_file(PREVALENCE_FILE) ? json_decode((string)file_get_contents(PREVALENCE_FILE), true) : null;
$countryPrevalence = $prevalenceData['countries'][$countryCode][$sex] ?? [];
// Values published only for both sexes (e.g. PM2.5) are used for men and women too.
$countryPrevalence += $prevalenceData['countries'][$countryCode]['both'] ?? [];

$defaults = $factors['defaultPrevalence'][$sex];
$prevalence = [];
$years = [];
$approximate = [];
foreach ($defaults as $name => $default) {
    if (isset($countryPrevalence[$name]['value']) && is_numeric($countryPrevalence[$name]['value'])) {
        $prevalence[$name] = (float)$countryPrevalence[$name]['value'];
        $years[$name] = $countryPrevalence[$name]['year'] ?? null;
    } else {
        $prevalence[$name] = (float)$default;
        $approximate[] = $name;
    }
}

unset($factors['defaultPrevalence']);

respond($factors + [
    'country' => $countryCode,
    'sex' => $sex,
    'prevalence' => $prevalence,
    'prevalenceYears' => $years,
    'approximate' => $approximate,
]);
