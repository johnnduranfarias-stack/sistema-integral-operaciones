$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $filePath = 'C:\Users\JDURAN1\Downloads\Hoja de Reportes de Produccion NUEVO (1).xlsx'
    $workbook = $excel.Workbooks.Open($filePath)
    $sheet = $workbook.Sheets.Item("FORMATO DE OPERACIONES")
    
    Write-Output "--- Scanning Rows 10 to 34 for Data ---"
    for ($r = 10; $r -le 34; $r++) {
        $rowData = @()
        $hasData = $false
        for ($c = 2; $c -le 26; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            if ($val -ne "") {
                $hasData = $true
                $rowData += "$([char](64+$c))${r}:[$val]"
            }
        }
        if ($hasData) {
            Write-Output "Row ${r} data: $($rowData -join ' | ')"
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
