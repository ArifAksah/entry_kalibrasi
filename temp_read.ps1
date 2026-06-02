$c = Get-Content 'app/ui/dashboard/certificate-verification-crud.tsx'
for ($i = 2029; $i -le 2045; $i++) {
    Write-Host "$($i+1): $($c[$i])"
}