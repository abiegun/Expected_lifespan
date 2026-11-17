<?php
/**
 * Supported countries service.
 *
 * GET countries.php                     countries only
 * GET countries.php?include=aggregates  also World, WHO regions and World Bank income groups
 *
 * Returns JSON:
 * {
 *   "count": 185,
 *   "generated": "...",
 *   "countries": [
 *     { "code": "POL", "iso2": "PL", "name": "Poland", "type": "country",
 *       "region": "EUR", "regionName": "Europe", "dataYear": 2023,
 *       "sexes": ["male", "female", "both"] }, ...
 *   ]
 * }
 *
 * "code" is the value to pass as "country" to life_expectancy.php.
 * Countries are sorted by name; aggregates (if requested) follow them.
 */

declare(strict_types=1);

require __DIR__ . '/lib/data.php';

api_start();

$include = strtolower(trim((string)($_GET['include'] ?? '')));
if ($include !== '' && $include !== 'aggregates') {
    fail('Parameter "include" may only be "aggregates".');
}
$withAggregates = $include === 'aggregates';

$data = load_data();

$countries = [];
$aggregates = [];

foreach ($data['countries'] as $code => $c) {
    $isCountry = ($c['type'] ?? '') === 'COUNTRY';
    if (!$isCountry && !$withAggregates) {
        continue;
    }
    $sexes = array_keys($c['sexes'] ?? []);
    if (!$sexes) {
        continue;
    }
    $item = [
        'code' => (string)$code,
        'iso2' => $c['iso2'] ?? null,
        'name' => $c['name'] ?? (string)$code,
        'type' => $isCountry ? 'country' : strtolower((string)$c['type']),
        'region' => $c['region']['code'] ?? null,
        'regionName' => $c['region']['name'] ?? null,
        'dataYear' => max(array_column($c['sexes'], 'year')),
        'sexes' => $sexes,
    ];
    if ($isCountry) {
        $countries[] = $item;
    } else {
        $aggregates[] = $item;
    }
}

$byName = fn($a, $b) => strcmp($a['name'], $b['name']);
usort($countries, $byName);
// Aggregates in a fixed order: World, WHO regions, income groups.
$order = ['global' => 0, 'region' => 1, 'worldbankincomegroup' => 2];
usort($aggregates, fn($a, $b) => [$order[$a['type']] ?? 9, $a['name']] <=> [$order[$b['type']] ?? 9, $b['name']]);

$list = array_merge($countries, $aggregates);

respond([
    'count' => count($list),
    'generated' => $data['generated'] ?? null,
    'countries' => $list,
]);
