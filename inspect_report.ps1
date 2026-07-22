$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $filePath = 'C:\Users\JDURAN1\Downloads\Hoja de Reportes de Produccion NUEVO (1).xlsx'
    $workbook = $excel.Workbooks.Open($filePath)
    
    Write-Output "--- Sheet Names ---"
    foreach ($sheet in $workbook.Sheets) {
        Write-Output $sheet.Name
    }
    
    Write-Output "`n--- Processing each sheet ---"
    $tempDir = 'C:\Users\JDURAN1\.gemini\antigravity\scratch\temp_inspect'
    if (!(Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir | Out-Null
    }
    
    for ($i = 1; $i -le $workbook.Sheets.Count; $i++) {
        $sheet = $workbook.Sheets.Item($i)
        $sheetName = $sheet.Name
        Write-Output "`n=================================================="
        Write-Output "SHEET: $sheetName"
        Write-Output "=================================================="
        
        $csvPath = Join-Path $tempDir "$sheetName.csv"
        # 6 = xlCSV format
        $sheet.SaveAs($csvPath, 6)
        
        $content = Get-Content -Path $csvPath -Head 40
        foreach ($line in $content) {
            Write-Output $line
        }
    }
    
    $workbook.Close($false)
} catch {
    Write-Error $_.Exception.Message
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
