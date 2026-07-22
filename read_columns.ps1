$csvPath = 'C:\Users\JDURAN1\.gemini\antigravity\scratch\registro-logistica\referencia.csv'
$data = Import-Csv -Path $csvPath -Delimiter ';'

# Obtener valores no vacíos de columnas de interés
Write-Output "Valores no vacíos de 'PARAMETETROS HORA':"
$paramValues = $data | Where-Object { $_.'PARAMETETROS HORA' -ne '' } | Select-Object -ExpandProperty 'PARAMETETROS HORA' -Unique
Write-Output ($paramValues -join ", ")

Write-Output "`nValores no vacíos de 'INDICADOR S.C':"
$scValues = $data | Where-Object { $_.'INDICADOR S.C' -ne '' } | Select-Object -ExpandProperty 'INDICADOR S.C' -Unique
Write-Output ($scValues -join ", ")

Write-Output "`nValores no vacíos de 'ESTATUS':"
$statusValues = $data | Where-Object { $_.'ESTATUS' -ne '' } | Select-Object -ExpandProperty 'ESTATUS' -Unique
Write-Output ($statusValues -join ", ")
