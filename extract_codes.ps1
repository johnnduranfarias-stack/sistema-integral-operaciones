$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $filePath = 'C:\Users\JDURAN1\Downloads\Hoja de Reportes de Produccion NUEVO (1).xlsx'
    $workbook = $excel.Workbooks.Open($filePath)
    $sheet = $workbook.Sheets.Item("FORMATO DE OPERACIONES")
    
    $downtimeCodes = @()
    
    # Let's inspect the cells containing the codes at the bottom (Rows 38 to 50)
    # The codes are organized in columns:
    # Col 2: Code, Col 3: Description
    # Col 4/5: Code/Description (wait, let's check)
    # Let's write a loop to extract them dynamically.
    # Looking at the sheet, rows 38 to 43 have code columns at Col 2, 4, 7, 13, 17, 24
    # Let's scan all cells in rows 38 to 52, checking if the text is a number.
    
    for ($r = 36; $r -le 52; $r++) {
        for ($c = 2; $c -le 26; $c++) {
            $text = $sheet.Cells.Item($r, $c).Text.Trim()
            if ($text -match '^\d+$') {
                # This is a code! Let's find its description. Usually it's in the next column or the one after.
                $code = [int]$text
                $desc = ""
                # Search next columns for description
                for ($dc = $c + 1; $dc -le $c + 4; $dc++) {
                    $dVal = $sheet.Cells.Item($r, $dc).Text.Trim()
                    if ($dVal -ne "" -and $dVal -notmatch '^\d+$' -and $dVal -ne "Total" -and $dVal -ne "|") {
                        $desc = $dVal
                        break
                    }
                }
                if ($desc -ne "") {
                    $downtimeCodes += [PSCustomObject]@{
                        code = $code
                        description = $desc
                        row = $r
                        col = $c
                    }
                }
            }
        }
    }
    
    # Also rows 62 to 110 contain the "Observaciones Generales" (long descriptions)
    # Let's extract those as "long_description" if they exist, or just fallback.
    $longDescriptions = @{}
    for ($r = 62; $r -le 111; $r++) {
        $codeText = $sheet.Cells.Item($r, 2).Text.Trim()
        $descText = $sheet.Cells.Item($r, 3).Text.Trim()
        if ($codeText -match '^\d+(-[A-Z])?$') {
            $longDescriptions[$codeText] = $descText
        }
    }
    
    # Let's output and save the data
    $output = @()
    # Sort codes numerically
    $sortedCodes = $downtimeCodes | Sort-Object code -Unique
    
    # Let's verify we have all 1 to 47 codes
    for ($i = 1; $i -le 47; $i++) {
        # Find short description
        $found = $downtimeCodes | Where-Object { $_.code -eq $i } | Select-Object -First 1
        $shortDesc = ""
        if ($found) { $shortDesc = $found.description }
        
        # Find long description
        $longKey = [string]$i
        $longDesc = ""
        if ($longDescriptions.Contains($longKey)) {
            $longDesc = $longDescriptions[$longKey]
        } else {
            $longDesc = $shortDesc
        }
        
        # If shortDesc is empty, see if we can find it in longDescriptions
        if ($shortDesc -eq "" -and $longDesc -ne "") {
            $shortDesc = $longDesc
        }
        
        $output += @{
            code = $i
            name = $shortDesc
            description = $longDesc
        }
    }
    
    # Let's also check if there are sub-codes like 19-A, 19-B, 19-C, 19-D
    foreach ($key in $longDescriptions.Keys) {
        if ($key -match '-') {
            $output += @{
                code = $key
                name = $longDescriptions[$key]
                description = $longDescriptions[$key]
            }
        }
    }
    
    $json = $output | ConvertTo-Json -Depth 5
    $json | Out-File -FilePath 'C:\Users\JDURAN1\.gemini\antigravity\scratch\downtime_codes.json' -Encoding utf8
    Write-Output "Successfully extracted downtime codes. Total: $($output.Count)"
    
    $workbook.Close($false)
} catch {
    Write-Error $_.Exception.Message
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
