
#!/usr/bin/env bash

# ============================================================
# LIFE EXPECTANCY DATA DOWNLOADER
#
# Sources:
#   WHO GHO API
#   World Bank Indicators API
#
# Platform:
#   Cygwin / Windows
#
# Dependencies:
#   bash, curl, jq, coreutils
#
# Usage:
#   ./download_life_expectancy.sh
#
# Optional:
#   START_YEAR=2000 END_YEAR=2025 ./download_life_expectancy.sh
#   OUTPUT_DIR=/cygdrive/d/life_data ./download_life_expectancy.sh
#
# ============================================================

set -Eeuo pipefail

# ------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------

BASE_DIR="${OUTPUT_DIR:-./life_expectancy_data}"

START_YEAR="${START_YEAR:-2000}"
END_YEAR="${END_YEAR:-2025}"

WHO_API="https://ghoapi.azureedge.net/api"
WB_API="https://api.worldbank.org/v2"

LOG_FILE="$BASE_DIR/download.log"

mkdir -p "$BASE_DIR"

# ------------------------------------------------------------
# LOGGING
# ------------------------------------------------------------

log() {
    local MESSAGE="$*"

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $MESSAGE"

    if [ -n "${LOG_FILE:-}" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $MESSAGE" \
            >> "$LOG_FILE"
    fi
}

error() {
    log "ERROR: $*"
    exit 1
}

# ------------------------------------------------------------
# DEPENDENCY CHECK
# ------------------------------------------------------------

check_dependencies() {

    log "Checking dependencies"

    for CMD in curl jq date mkdir mv rm; do

        if ! command -v "$CMD" >/dev/null 2>&1; then
            error "Missing command: $CMD"
        fi

    done

    log "Dependencies OK"
}

# ------------------------------------------------------------
# DIRECTORY STRUCTURE
# ------------------------------------------------------------

create_directories() {

    mkdir -p "$BASE_DIR/who/data"
    mkdir -p "$BASE_DIR/who/metadata"

    mkdir -p "$BASE_DIR/world_bank/data"
    mkdir -p "$BASE_DIR/world_bank/metadata"

    mkdir -p "$BASE_DIR/logs"
}

# ------------------------------------------------------------
# DOWNLOAD FUNCTION
# ------------------------------------------------------------

download() {

    local URL="$1"
    local OUTPUT="$2"

    local TEMP_FILE="${OUTPUT}.download"

    log "Downloading: $OUTPUT"

    if ! curl \
        --fail \
        --location \
        --silent \
        --show-error \
        --retry 4 \
        --retry-delay 3 \
        --connect-timeout 30 \
        --max-time 600 \
        "$URL" \
        -o "$TEMP_FILE"
    then

        rm -f "$TEMP_FILE"

        error "Download failed: $URL"

    fi

    if [ ! -s "$TEMP_FILE" ]; then

        rm -f "$TEMP_FILE"

        error "Empty download: $URL"

    fi

    mv "$TEMP_FILE" "$OUTPUT"

    log "Saved: $OUTPUT"
}

# ------------------------------------------------------------
# WHO ODATA PAGINATION
# ------------------------------------------------------------

download_odata() {

    local URL="$1"
    local OUTPUT="$2"

    local TMP_FILE="${OUTPUT}.tmp"
    local PAGE_FILE="${OUTPUT}.page"

    local NEXT_URL
    local COUNT

    echo "[]" > "$TMP_FILE"

    while [ -n "$URL" ]; do

        download "$URL" "$PAGE_FILE"

        if ! jq empty "$PAGE_FILE" >/dev/null 2>&1; then

            rm -f "$TMP_FILE" "$PAGE_FILE"

            error "Invalid WHO JSON response: $URL"

        fi

        # OData response must contain a value array.
        if ! jq -e '.value | type == "array"' \
            "$PAGE_FILE" >/dev/null; then

            rm -f "$TMP_FILE" "$PAGE_FILE"

            error "Unexpected WHO response format: $URL"

        fi

        jq -s \
            '.[0] + .[1].value' \
            "$TMP_FILE" "$PAGE_FILE" \
            > "${TMP_FILE}.new"

        mv "${TMP_FILE}.new" "$TMP_FILE"

        NEXT_URL=$(jq -r \
            '."@odata.nextLink" // empty' \
            "$PAGE_FILE")

        URL="$NEXT_URL"

    done

    COUNT=$(jq 'length' "$TMP_FILE")

    if [ "$COUNT" -eq 0 ]; then

        rm -f "$TMP_FILE" "$PAGE_FILE"

        error "WHO returned zero records: $OUTPUT"

    fi

    mv "$TMP_FILE" "$OUTPUT"

    rm -f "$PAGE_FILE"

    log "WHO records saved: $COUNT ($OUTPUT)"
}

# ------------------------------------------------------------
# VALIDATE JSON
# ------------------------------------------------------------

validate_json() {

    local FILE="$1"

    if [ ! -s "$FILE" ]; then
        error "Missing or empty file: $FILE"
    fi

    if ! jq empty "$FILE" >/dev/null 2>&1; then
        error "Invalid JSON: $FILE"
    fi
}

# ------------------------------------------------------------
# WHO DOWNLOADS
# ------------------------------------------------------------

download_who() {

    log "============================================"
    log "WHO DOWNLOADS"
    log "============================================"

    # WHO metadata

    download_odata \
        "$WHO_API/Indicator" \
        "$BASE_DIR/who/metadata/indicators.json"

    download_odata \
        "$WHO_API/Dimension" \
        "$BASE_DIR/who/metadata/dimensions.json"

    for DIMENSION in COUNTRY SEX AGEGROUP; do

        download_odata \
            "$WHO_API/DIMENSION/$DIMENSION/DimensionValues" \
            "$BASE_DIR/who/metadata/${DIMENSION}.json"

    done

    # WHO indicator definitions

    cat > "$BASE_DIR/who/metadata/life_table_indicators.csv" <<EOF
variable,indicator_code
nMx,LIFE_0000000029
nqx,LIFE_0000000030
lx,LIFE_0000000031
ndx,LIFE_0000000032
nLx,LIFE_0000000033
Tx,LIFE_0000000034
ex,LIFE_0000000035
EOF

    # Download each WHO life-table variable.

    while IFS=, read -r VARIABLE CODE
    do

        if [ "$VARIABLE" = "variable" ]; then
            continue
        fi

        log "WHO variable: $VARIABLE"

        download_odata \
            "$WHO_API/$CODE" \
            "$BASE_DIR/who/data/${VARIABLE}.json"

        validate_json "$BASE_DIR/who/data/${VARIABLE}.json"

        jq 'length' "$BASE_DIR/who/data/${VARIABLE}.json"

    done < "$BASE_DIR/who/metadata/life_table_indicators.csv"

    # WHO life expectancy at birth

    download_odata \
        "$WHO_API/WHOSIS_000001" \
        "$BASE_DIR/who/data/life_expectancy_at_birth.json"

    log "WHO downloads completed"
}

# ------------------------------------------------------------
# WHO RISK FACTOR PREVALENCE (for the survey)
#
# How common each survey risk factor is per country and sex.
# Used to compare a person's answers with the national average.
# ------------------------------------------------------------

download_who_prevalence() {

    log "============================================"
    log "WHO RISK FACTOR PREVALENCE"
    log "============================================"

    mkdir -p "$BASE_DIR/who/prevalence"

    cat > "$BASE_DIR/who/metadata/prevalence_indicators.csv" <<EOF
variable,indicator_code
smoking_current,M_Est_smk_curr_std
obesity,NCD_BMI_30A
overweight,NCD_BMI_25A
insufficient_activity,NCD_PAA
alcohol_litres,SA_0000001688
alcohol_abstainers,SA_0000001411
diabetes,NCD_GLUC_04
hypertension,NCD_HYP_PREVALENCE_A
hypertension_controlled,NCD_HYP_CONTROL_A
pm25,SDGPM25
EOF

    while IFS=, read -r VARIABLE CODE
    do

        if [ "$VARIABLE" = "variable" ]; then
            continue
        fi

        log "WHO prevalence: $VARIABLE ($CODE)"

        download_odata \
            "$WHO_API/$CODE" \
            "$BASE_DIR/who/prevalence/${VARIABLE}.json"

        validate_json "$BASE_DIR/who/prevalence/${VARIABLE}.json"

    done < "$BASE_DIR/who/metadata/prevalence_indicators.csv"

    log "WHO prevalence downloads completed"
}

# ------------------------------------------------------------
# WORLD BANK DOWNLOADS
# ------------------------------------------------------------

download_world_bank() {

    log "============================================"
    log "WORLD BANK DOWNLOADS"
    log "============================================"

    # Countries

    download \
        "$WB_API/country?format=json&per_page=400" \
        "$BASE_DIR/world_bank/metadata/countries.json"

    # Indicator metadata

    download \
        "$WB_API/indicator/SP.DYN.LE00.MA.IN?format=json" \
        "$BASE_DIR/world_bank/metadata/male_indicator.json"

    download \
        "$WB_API/indicator/SP.DYN.LE00.FE.IN?format=json" \
        "$BASE_DIR/world_bank/metadata/female_indicator.json"

    # Male life expectancy at birth

    download \
        "$WB_API/country/all/indicator/SP.DYN.LE00.MA.IN?date=$START_YEAR:$END_YEAR&format=json&per_page=20000" \
        "$BASE_DIR/world_bank/data/life_expectancy_male.json"

    # Female life expectancy at birth

    download \
        "$WB_API/country/all/indicator/SP.DYN.LE00.FE.IN?date=$START_YEAR:$END_YEAR&format=json&per_page=20000" \
        "$BASE_DIR/world_bank/data/life_expectancy_female.json"

    # World Bank population metadata

    download \
        "$WB_API/indicator/SP.POP.TOTL?format=json" \
        "$BASE_DIR/world_bank/metadata/population_indicator.json"

    # Validate World Bank JSON responses.

    for FILE in "$BASE_DIR"/world_bank/*/*.json; do

        validate_json "$FILE"

    done

    log "World Bank downloads completed"
}

# ------------------------------------------------------------
# DATA SUMMARY
# ------------------------------------------------------------

create_summary() {

    local SUMMARY="$BASE_DIR/data_summary.txt"

    {

        echo "LIFE EXPECTANCY DATA DOWNLOAD"
        echo "============================="
        echo
        echo "Date: $(date)"
        echo "WHO source: $WHO_API"
        echo "World Bank source: $WB_API"
        echo "World Bank years: $START_YEAR - $END_YEAR"
        echo

        echo "WHO LIFE TABLES"
        echo "---------------"

        for FILE in "$BASE_DIR"/who/data/*.json; do

            if [ -f "$FILE" ]; then

                echo "$(basename "$FILE"): $(jq 'length' "$FILE") records"

            fi

        done

        echo
        echo "WHO RISK FACTOR PREVALENCE"
        echo "--------------------------"

        for FILE in "$BASE_DIR"/who/prevalence/*.json; do

            if [ -f "$FILE" ]; then

                echo "$(basename "$FILE"): $(jq 'length' "$FILE") records"

            fi

        done

        echo
        echo "WORLD BANK"
        echo "----------"

        for FILE in "$BASE_DIR"/world_bank/data/*.json; do

            if [ -f "$FILE" ]; then

                echo "$(basename "$FILE"):"

                jq -r '
                    if type == "array" then
                        "Records: \((.[1] // []) | length)"
                    else
                        "Records: unknown"
                    end
                ' "$FILE"

            fi

        done

        echo
        echo "FILES"
        echo "-----"

        find "$BASE_DIR" -type f

    } > "$SUMMARY"

    log "Summary created: $SUMMARY"

    cat "$SUMMARY"
}

# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------

main() {

    check_dependencies

    create_directories

    log "Starting life expectancy download"

    log "Output: $BASE_DIR"

    download_who

    download_who_prevalence

    download_world_bank

    create_summary

    log "============================================"
    log "DOWNLOAD COMPLETED"
    log "============================================"
}

main "$@"
