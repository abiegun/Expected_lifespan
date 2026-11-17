<?php
/**
 * Shared helpers for the JSON services: response output and loading
 * data/nmx_latest.json (produced by prepare_data.php).
 */

declare(strict_types=1);

const DATA_FILE = __DIR__ . '/../data/nmx_latest.json';
const SECONDS_PER_DAY = 86400;
const DAYS_PER_YEAR = 365.25;
const SECONDS_PER_YEAR = 31557600; // 365.25 * 86400

/** Split seconds into years / days / hh:mm:ss (year = 365.25 days). */
function format_duration(int $seconds): array
{
    $years = intdiv($seconds, SECONDS_PER_YEAR);
    $rest = $seconds - $years * SECONDS_PER_YEAR;
    $days = intdiv($rest, SECONDS_PER_DAY);
    $rest -= $days * SECONDS_PER_DAY;
    $h = intdiv($rest, 3600);
    $m = intdiv($rest % 3600, 60);
    $s = $rest % 60;
    $time = sprintf('%02d:%02d:%02d', $h, $m, $s);

    return [
        'years' => $years,
        'days' => $days,
        'hours' => $h,
        'minutes' => $m,
        'seconds' => $s,
        'time' => $time,
        'text' => sprintf('%d %s, %d %s, %s',
            $years, $years === 1 ? 'year' : 'years',
            $days, $days === 1 ? 'day' : 'days',
            $time),
    ];
}

/**
 * Resolve country + sex to a fitted mortality model; responds with an error on failure.
 * Returns [countryCode, countryEntry, sex, series, model].
 */
function resolve_model(array $data, string $countryParam, string $sexParam): array
{
    $countryParam = strtoupper(trim($countryParam));
    if (!preg_match('/^[A-Z0-9_]{2,12}$/', $countryParam)) {
        fail('Parameter "country" is required (WHO / ISO alpha-3 code, e.g. POL).');
    }
    $sex = mortality_normalize_sex($sexParam);
    if ($sex === null) {
        fail('Parameter "sex" must be male, female or empty.');
    }
    $country = $data['countries'][$countryParam] ?? null;
    if ($country === null) {
        fail("No data for country \"$countryParam\".", 404);
    }
    $series = $country['sexes'][$sex] ?? null;
    if ($series === null) {
        fail("No data for country \"$countryParam\" and sex \"$sex\".", 404);
    }
    try {
        $model = mortality_fit_best_model($series['rates']);
    } catch (Throwable $e) {
        fail('Calculation failed: ' . $e->getMessage(), 500);
    }
    return [$countryParam, $country, $sex, $series, $model];
}

/**
 * Send common headers; answer CORS preflight.
 * $cacheSeconds = 0 forbids caching (for answers that depend on the current time).
 */
function api_start(int $cacheSeconds = 3600): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    if ($cacheSeconds > 0) {
        header('Cache-Control: public, max-age=' . $cacheSeconds);
    } else {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        // CORS preflight (needed for POST with a JSON body).
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
        http_response_code(204);
        exit;
    }
}

/**
 * Request parameters: JSON body for POST (keeps values out of server access
 * logs, which record full URLs), query string for GET.
 */
function request_params(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        $raw = (string)file_get_contents('php://input');
        if ($raw === '') {
            return $_POST;
        }
        $body = json_decode($raw, true);
        if (!is_array($body)) {
            fail('Request body must be a JSON object.');
        }
        return $body;
    }
    return $_GET;
}

/** Read a parameter as a trimmed string ('' when missing). */
function param(array $params, string $name): string
{
    $v = $params[$name] ?? '';
    return is_scalar($v) ? trim((string)$v) : '';
}

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

function fail(string $message, int $status = 400): void
{
    respond(['error' => $message], $status);
}

/** Load and validate the prepared data file; responds with HTTP 500 on failure. */
function load_data(): array
{
    if (!is_file(DATA_FILE)) {
        fail('Data file missing. Run prepare_data.php.', 500);
    }
    $data = json_decode((string)file_get_contents(DATA_FILE), true);
    if (!is_array($data) || !isset($data['countries']) || !is_array($data['countries'])) {
        fail('Data file is corrupt. Run prepare_data.php again.', 500);
    }
    return $data;
}
