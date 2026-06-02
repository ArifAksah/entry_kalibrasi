$c = Get-Content 'temp_git_file.tsx'
Write-Host "=== Lines 2030-2050 from git version ==="
for ($i = 2029; $i -le 2049; $i++) {
    Write-Host "$($i+1): $($c[$i])"
}