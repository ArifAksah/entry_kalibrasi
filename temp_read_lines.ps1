$c = Get-Content 'app/letters/[id]/print/page.tsx'
for ($i = 160; $i -le 170; $i++) {
    Write-Host "$($i+1): $($c[$i])"
}