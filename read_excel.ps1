$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $workbook = $excel.Workbooks.Open('C:\Users\JDURAN1\.gemini\antigravity\scratch\registro-logistica\referencia.xlsx')
    $sheet = $workbook.Sheets.Item(1)
    
    # Exportar a CSV (6 es el formato xlCSV)
    $csvPath = 'C:\Users\JDURAN1\.gemini\antigravity\scratch\registro-logistica\referencia.csv'
    $workbook.SaveAs($csvPath, 6)
    Write-Output "Excel exportado exitosamente a CSV"
    
    # Imprimir las primeras 10 líneas del CSV para análisis
    $content = Get-Content -Path $csvPath -Head 15
    foreach ($line in $content) {
        Write-Output $line
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
