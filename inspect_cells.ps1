$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $filePath = 'C:\Users\JDURAN1\Downloads\Hoja de Reportes de Produccion NUEVO (1).xlsx'
    $workbook = $excel.Workbooks.Open($filePath)
    $sheet = $workbook.Sheets.Item("FORMATO DE OPERACIONES")
    
    $usedRange = $sheet.UsedRange
    $rowsCount = $usedRange.Rows.Count
    $colsCount = $usedRange.Columns.Count
    $startRow = $usedRange.Row
    $startCol = $usedRange.Column
    
    Write-Output "Range: Rows ${startRow} to $($startRow + $rowsCount - 1), Cols ${startCol} to $($startCol + $colsCount - 1)"
    
    for ($r = $startRow; $r -lt ($startRow + $rowsCount); $r++) {
        $rowCells = @()
        $hasContent = $false
        for ($c = $startCol; $c -lt ($startCol + $colsCount); $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            if ($val -ne "") {
                $hasContent = $true
            }
            $rowCells += "$(${c}):[$val]"
        }
        if ($hasContent) {
            Write-Output "Row ${r}: $($rowCells -join ' | ')"
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
