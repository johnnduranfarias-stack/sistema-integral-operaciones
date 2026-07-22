$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $filePath = 'C:\Users\JDURAN1\Downloads\Hoja de Reportes de Produccion NUEVO (1).xlsx'
    $workbook = $excel.Workbooks.Open($filePath)
    $sheet = $workbook.Sheets.Item("FORMATO DE OPERACIONES")
    
    Write-Output "--- Merged Cells and Headers in Row 7-9 ---"
    for ($c = 2; $c -le 26; $c++) {
        $cell7 = $sheet.Cells.Item(7, $c)
        $cell8 = $sheet.Cells.Item(8, $c)
        $cell9 = $sheet.Cells.Item(9, $c)
        
        Write-Output "Col $c ($([char](64+$c))):"
        Write-Output "  Row 7: '$($cell7.Text)' [Merged: $($cell7.MergeCells)]"
        Write-Output "  Row 8: '$($cell8.Text)' [Merged: $($cell8.MergeCells)]"
        Write-Output "  Row 9: '$($cell9.Text)' [Merged: $($cell9.MergeCells)]"
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
