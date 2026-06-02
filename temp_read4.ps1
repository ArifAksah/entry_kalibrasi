$c = Get-Content 'app/ui/dashboard/certificate-verification-crud.tsx'
Write-Host "Total lines: $($c.Count)"
Write-Host ""
Write-Host "=== Last 50 lines ==="
$start = [Math]::Max(0, $c.Count - 50)
for ($i = $start; $i -lt $c.Count; $i++) {
    Write-Host "$($i+1): $($c[$i])"
}