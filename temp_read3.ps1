$c = Get-Content 'app/ui/dashboard/certificate-verification-crud.tsx'
Write-Host "Total lines: $($c.Count)"
for ($i = 2040; $i -le 2060; $i++) {
    if ($i -lt $c.Count) {
        Write-Host "$($i+1): $($c[$i])"
    }
}