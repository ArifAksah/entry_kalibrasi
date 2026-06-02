$c = Get-Content 'app/ui/dashboard/certificate-verification-crud.tsx'
for ($i = 1999; $i -le 2031; $i++) {
    Write-Host "$($i+1): $($c[$i])"
}