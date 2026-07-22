$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $filePath = 'C:\Users\JDURAN1\Downloads\Hoja de Reportes de Produccion NUEVO (1).xlsx'
    $workbook = $excel.Workbooks.Open($filePath)
    
    foreach ($sheet in $workbook.Sheets) {
        $name = $sheet.Name
        $usedRange = $sheet.UsedRange
        $rowsCount = $usedRange.Rows.Count
        $colsCount = $usedRange.Columns.Count
        $startRow = $usedRange.Row
        $startCol = $usedRange.Column
        Write-Output "Sheet: $name"
        Write-Output "  Used Range: Row $startRow to $($startRow + $rowsCount - 1), Col $startCol to $($startCol + $colsCount - 1)"
        Write-Output "  Dimensions: $rowsCount rows x $colsCount columns"
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
