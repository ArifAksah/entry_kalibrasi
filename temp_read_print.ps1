"$c = Get-Content 'app/letters/[id]/print/page.tsx'
for ($i = 164; $i -le 168; $i++) {
    Write-Host \"$($i+1): $($c[$i])\"
}"