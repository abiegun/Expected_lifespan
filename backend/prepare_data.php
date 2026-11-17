<?php
/**
 * Builds data/nmx_latest.json from the large WHO nMx.json download.
 *
 * nMx.json is ~200 MB, far too big to load on every request, so this script
 * streams it once and keeps only the latest year of age-specific death rates
 * for every country / region and sex (a file of a few hundred KB).
 *
 * Run after each data refresh (download_life_expectancy.sh), from the command line:
 *     php prepare_data.php
 *     php prepare_data.php path/to/nMx.json path/to/output.json
 *
 * Memory use stays low (records are decoded one at a time), so it also works
 * on shared hosting, e.g. from a cron job.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Run from the command line.\n");
}

require __DIR__ . '/lib/mortality.php';

const NMX_INDICATOR = 'LIFE_0000000029';

$input       = $argv[1] ?? __DIR__ . '/life_expectancy_data/who/data/nMx.json';
$output      = $argv[2] ?? __DIR__ . '/data/nmx_latest.json';
$countryFile = __DIR__ . '/life_expectancy_data/who/metadata/COUNTRY.json';
$wbCountryFile = __DIR__ . '/life_expectancy_data/world_bank/metadata/countries.json';

// Names for WHO aggregate entries (not present in COUNTRY.json).
const AGGREGATE_NAMES = [
    'GLOBAL' => 'World',
    'AFR'    => 'Africa',
    'AMR'    => 'Americas',
    'EMR'    => 'Eastern Mediterranean',
    'EUR'    => 'Europe',
    'SEAR'   => 'South-East Asia',
    'WPR'    => 'Western Pacific',
    'WB_HI'  => 'High income',
    'WB_UMI' => 'Upper-middle income',
    'WB_LMI' => 'Lower-middle income',
    'WB_LI'  => 'Low income',
];

/**
 * Stream the objects of a top-level JSON array, calling $onRecord for each.
 * Works for both pretty-printed and minified files.
 */
function stream_json_array(string $file, callable $onRecord): int
{
    $fh = fopen($file, 'rb');
    if (!$fh) {
        throw new RuntimeException("Cannot open $file");
    }
    $depth = 0;
    $inString = false;
    $escape = false;
    $buf = '';
    $count = 0;

    while (!feof($fh)) {
        $chunk = fread($fh, 1 << 20);
        $len = strlen($chunk);
        $start = ($depth >= 2) ? 0 : -1; // start of current object inside this chunk

        for ($i = 0; $i < $len; $i++) {
            $c = $chunk[$i];
            if ($inString) {
                if ($escape) {
                    $escape = false;
                } elseif ($c === '\\') {
                    $escape = true;
                } elseif ($c === '"') {
                    $inString = false;
                }
                continue;
            }
            if ($c === '"') {
                $inString = true;
            } elseif ($c === '{' || $c === '[') {
                $depth++;
                if ($depth === 2 && $c === '{') {
                    $start = $i;
                    $buf = '';
                }
            } elseif ($c === '}' || $c === ']') {
                if ($depth === 2 && $c === '}') {
                    $buf .= substr($chunk, $start, $i - $start + 1);
                    $rec = json_decode($buf, true);
                    if (is_array($rec)) {
                        $onRecord($rec);
                        $count++;
                    }
                    $buf = '';
                    $start = -1;
                }
                $depth--;
            }
        }
        if ($depth >= 2 && $start >= 0) {
            $buf .= substr($chunk, $start);
        }
    }
    fclose($fh);
    return $count;
}

// Country names and WHO regions from WHO metadata (optional).
$names = AGGREGATE_NAMES;
$regions = [];
if (is_file($countryFile)) {
    foreach (json_decode((string)file_get_contents($countryFile), true) ?: [] as $c) {
        if (isset($c['Code'], $c['Title'])) {
            $names[$c['Code']] = $c['Title'];
            if (!empty($c['ParentCode'])) {
                $regions[$c['Code']] = ['code' => $c['ParentCode'], 'name' => $c['ParentTitle'] ?? null];
            }
        }
    }
}

// ISO alpha-2 codes from World Bank metadata (optional). File is [paging, [countries...]].
$iso2 = [];
if (is_file($wbCountryFile)) {
    $wb = json_decode((string)file_get_contents($wbCountryFile), true) ?: [];
    $list = (isset($wb[1]) && is_array($wb[1])) ? $wb[1] : $wb;
    foreach ($list as $c) {
        if (isset($c['id'], $c['iso2Code']) && preg_match('/^[A-Z]{2}$/', $c['iso2Code'])) {
            $iso2[$c['id']] = $c['iso2Code'];
        }
    }
}

// $data[country][sex][year][midpoint] = rate
$data = [];
$types = [];
$used = 0;
$skipped = 0;

$total = stream_json_array($input, function (array $r) use (&$data, &$types, &$used, &$skipped) {
    if (($r['IndicatorCode'] ?? null) !== NMX_INDICATOR) {
        $skipped++;
        return;
    }
    $country = $r['SpatialDim'] ?? null;
    $year = isset($r['TimeDim']) ? (int)$r['TimeDim'] : null;
    $sex = mortality_normalize_sex($r['Dim1'] ?? null);
    $age = mortality_parse_age_group($r['Dim2'] ?? null);
    $rate = $r['NumericValue'] ?? null;

    if (!$country || !$year || !$sex || !$age || !is_numeric($rate) || $rate <= 0) {
        $skipped++;
        return;
    }
    $data[$country][$sex][$year][(string)$age['midpoint']] = (float)$rate;
    $types[$country] = $r['SpatialDimType'] ?? null;
    $used++;
});

$countries = [];
ksort($data);
foreach ($data as $country => $bySex) {
    $isCountry = $types[$country] === 'COUNTRY';
    $entry = [
        'name' => $names[$country] ?? $country,
        'type' => $types[$country],
        'iso2' => $isCountry ? ($iso2[$country] ?? null) : null,
        'region' => $isCountry ? ($regions[$country] ?? null) : null,
        'sexes' => [],
    ];
    foreach (['male', 'female', 'both'] as $sex) {
        if (empty($bySex[$sex])) {
            continue;
        }
        $year = max(array_keys($bySex[$sex]));
        $rates = $bySex[$sex][$year];
        uksort($rates, fn($a, $b) => (float)$a <=> (float)$b);
        $entry['sexes'][$sex] = ['year' => $year, 'rates' => $rates];
    }
    $countries[$country] = $entry;
}

$result = [
    'source' => 'WHO GHO life tables, nMx (' . NMX_INDICATOR . ')',
    'generated' => gmdate('c'),
    'countries' => $countries,
];

if (!is_dir(dirname($output))) {
    mkdir(dirname($output), 0775, true);
}
$tmp = $output . '.tmp';
file_put_contents($tmp, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
rename($tmp, $output); // atomic swap, so the service never reads a half-written file

printf("Records read: %d, used: %d, skipped: %d\n", $total, $used, $skipped);
printf("Countries/regions: %d\nWritten: %s (%d bytes)\n", count($countries), $output, filesize($output));

// ---------------------------------------------------------------------------
// Risk factor prevalence for the survey -> data/prevalence.json
//
// Input:  life_expectancy_data/who/prevalence/<variable>.json (download script)
// Output: { countries: { POL: { male: { smoking_current: {value, year}, ... } } } }
// Percentages are stored as fractions (31.2 % -> 0.312); alcohol in litres.
// Missing files are skipped; the survey then uses approximate defaults.
// ---------------------------------------------------------------------------

const PREVALENCE_VARIABLES = [
    // variable => is percentage
    'smoking_current'       => true,
    'obesity'               => true,
    'overweight'            => true,
    'insufficient_activity' => true,
    'alcohol_litres'        => false,
    'alcohol_abstainers'    => true,
];

$prevDir = __DIR__ . '/life_expectancy_data/who/prevalence';
$prevOutput = dirname($output) . '/prevalence.json';

/**
 * Pick the sex of a GHO record from whichever dimension is of type SEX.
 * Returns [sex|null, ok]: ok=false when the record has another dimension
 * (e.g. age group, residence) that is not an "all/total/adult" value.
 */
function prevalence_record_sex(array $r): array
{
    $sex = 'both';
    foreach (['Dim1', 'Dim2', 'Dim3'] as $d) {
        $type = $r[$d . 'Type'] ?? null;
        $value = $r[$d] ?? null;
        if ($type === null || $value === null) {
            continue;
        }
        if ($type === 'SEX') {
            $sex = mortality_normalize_sex($value);
            if ($sex === null) {
                return [null, false];
            }
            continue;
        }
        // Any other dimension: accept only totals / adult "plus" groups.
        if (!preg_match('/TOTAL|ALL|PLUS|BTSX|18\+|15\+/i', (string)$value)) {
            return [null, false];
        }
    }
    return [$sex, true];
}

$prevalence = [];
$prevStats = [];
foreach (PREVALENCE_VARIABLES as $variable => $isPercent) {
    $file = "$prevDir/$variable.json";
    if (!is_file($file)) {
        $prevStats[$variable] = 'file missing';
        continue;
    }
    $records = json_decode((string)file_get_contents($file), true);
    if (!is_array($records)) {
        $prevStats[$variable] = 'invalid JSON';
        continue;
    }
    $records = $records['value'] ?? $records;
    $best = []; // [country][sex] => [year, value]
    $usedCount = 0;
    foreach ($records as $r) {
        $country = $r['SpatialDim'] ?? null;
        $year = isset($r['TimeDim']) ? (int)$r['TimeDim'] : 0;
        $value = $r['NumericValue'] ?? null;
        if (!$country || !$year || !is_numeric($value)) {
            continue;
        }
        [$sex, $ok] = prevalence_record_sex($r);
        if (!$ok) {
            continue;
        }
        $value = (float)$value;
        if ($isPercent) {
            $value /= 100;
        }
        if (!isset($best[$country][$sex]) || $year > $best[$country][$sex][0]) {
            $best[$country][$sex] = [$year, $value];
        }
        $usedCount++;
    }
    foreach ($best as $country => $bySex) {
        foreach ($bySex as $sex => [$year, $value]) {
            $prevalence[$country][$sex][$variable] = ['value' => round($value, 4), 'year' => $year];
        }
    }
    $prevStats[$variable] = sprintf('%d records used, %d countries', $usedCount, count($best));
}

ksort($prevalence);
$tmp = $prevOutput . '.tmp';
file_put_contents($tmp, json_encode([
    'source' => 'WHO GHO risk factor estimates (see download_life_expectancy.sh)',
    'generated' => gmdate('c'),
    'countries' => $prevalence,
], JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
rename($tmp, $prevOutput);

echo "\nRisk factor prevalence:\n";
foreach ($prevStats as $variable => $stat) {
    printf("  %-22s %s\n", $variable, $stat);
}
printf("Written: %s (%d bytes)\n", $prevOutput, filesize($prevOutput));
