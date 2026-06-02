$c = Get-Content 'temp_git_file.tsx'
Write-Host "Total lines: $($c.Count)"
Write-Host ""
Write-Host "=== Last 60 lines ==="
$start = [Math]::Max(0, $c.Count - 60)
for ($i = $start; $i -lt $c.Count; $i++) {
    Write-Host "$($i+1): $($c[$i])"
}