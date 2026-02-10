# Test Senat API endpoints
# Usage: .\test-senat-api.ps1

$base = "https://api.sejm.gov.pl/senat"
$term = 11

$endpoints = @(
    # Root
    "/term"
    "/term$term"

    # Senators
    "/term$term/senators"
    "/term$term/senators/1"

    # Sittings
    "/term$term/sittings"
    "/term$term/sittings/1"
    "/term$term/sittings/1/votes"
    "/term$term/sittings/1/speeches"

    # Proceedings (jak Sejm)
    "/term$term/proceedings"
    "/term$term/proceedings/1"

    # Committees
    "/term$term/committees"
    "/term$term/committees/1"

    # Interpellations
    "/term$term/interpellations"

    # Prints
    "/term$term/prints"

    # Written questions
    "/term$term/writtenQuestions"

    # Votes (standalone)
    "/term$term/votings"
    "/term$term/votings/1"

    # MPs (jak Sejm)
    "/term$term/MP"
    "/term$term/MP/1"
)

Write-Host "=== Test API Senatu ===" -ForegroundColor Cyan
Write-Host "Base: $base" -ForegroundColor Gray
Write-Host ""

$found = 0
$notFound = 0

foreach ($ep in $endpoints) {
    $url = "$base$ep"
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -ErrorAction Stop
        $status = $response.StatusCode
        $len = $response.Content.Length
        $preview = $response.Content.Substring(0, [Math]::Min(120, $response.Content.Length))
        Write-Host "[${status}] $ep" -ForegroundColor Green -NoNewline
        Write-Host " (${len}B) $preview" -ForegroundColor DarkGray
        $found++
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if (-not $status) { $status = "ERR" }
        $color = if ($status -eq 404) { "DarkYellow" } else { "Red" }
        Write-Host "[${status}] $ep" -ForegroundColor $color
        $notFound++
    }
}

Write-Host ""
Write-Host "=== Wynik ===" -ForegroundColor Cyan
Write-Host "Dzialajace: $found" -ForegroundColor Green
Write-Host "Niedostepne: $notFound" -ForegroundColor Yellow

# Bonus: test roznych kadencji
Write-Host ""
Write-Host "=== Test kadencji 1-11 (sittings) ===" -ForegroundColor Cyan
for ($t = 1; $t -le 11; $t++) {
    $url = "$base/term$t/sittings"
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -ErrorAction Stop
        $len = $response.Content.Length
        Write-Host "[OK ] Kadencja $t - ${len}B" -ForegroundColor Green
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "[${status}] Kadencja $t" -ForegroundColor DarkYellow
    }
}
