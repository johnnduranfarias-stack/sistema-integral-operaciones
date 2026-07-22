$dbDir = 'C:\Users\JDURAN1\.gemini\antigravity\scratch\reporte-operaciones-app'
if (!(Test-Path $dbDir)) {
    New-Item -ItemType Directory -Path $dbDir | Out-Null
}

$codesJsonPath = 'C:\Users\JDURAN1\.gemini\antigravity\scratch\downtime_codes.json'
if (Test-Path $codesJsonPath) {
    $codes = Get-Content -Raw -Path $codesJsonPath | ConvertFrom-Json
} else {
    $codes = @()
    Write-Warning "downtime_codes.json not found, initializing with empty codes."
}

# Create users
$users = [ordered]@{
    "admin" = @{
        username = "admin"
        name = "Johnny Duran"
        role = "admin"
        line = $null
        passwordHash = "6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6" # admin2026
    }
    "erick" = @{
        username = "erick"
        name = "Erick Villacrez"
        role = "supervisor"
        line = "Ferpagro"
        passwordHash = "1a8b3eb42d6a922038af4d33242334788add7fc0400790f6c84c698a64439806" # ferpagro2026
    }
    "paul" = @{
        username = "paul"
        name = "Paul Carrazo"
        role = "supervisor"
        line = "Sackeett"
        passwordHash = "ba3b6cd738e2677eebbd961392466bd65fe14b60ababc8c22d400236c02272f8" # sackeett2026
    }
    "ronaldr" = @{
        username = "ronaldr"
        name = "Ronald Rodriguez"
        role = "supervisor"
        line = "Doyle 2"
        passwordHash = "a4e2fe7c8f415d213d0f50bd1e50d5459e5b167bd447bde77cc48cab85e0dadf" # doyle2_2026
    }
    "ronaldc" = @{
        username = "ronaldc"
        name = "Ronald Cunighan"
        role = "supervisor"
        line = "Doyle 1"
        passwordHash = "5c8f072c9df1de23472cc8d975762815ee2b2ac92d22eb2ea67434faba3e2e21" # doyle1_2026
    }
    "nery" = @{
        username = "nery"
        name = "Nery Zambrano"
        role = "supervisor"
        line = "Nacional"
        passwordHash = "f1d5c8140b77d132e8e02a94094f1714e82dd3342bf242771ad7bf75247ea583" # nacional2026
    }
}

# Combine into DB structure
$db = @{
    users = $users
    downtime_codes = $codes
    reports = @{}
    settings = @{
        lines = @("Ferpagro", "Sackeett", "Doyle 2", "Doyle 1", "Nacional")
        shifts = @("Turno 1", "Turno 2", "Turno 3")
    }
}

$dbJson = $db | ConvertTo-Json -Depth 10
$dbJson | Out-File -FilePath (Join-Path $dbDir "db.json") -Encoding utf8
Write-Output "db.json initialized successfully at $(Join-Path $dbDir "db.json")"
