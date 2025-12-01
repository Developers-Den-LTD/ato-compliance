# PowerShell script to fix all import paths

Write-Host "Fixing import paths..." -ForegroundColor Cyan

$count = 0

Get-ChildItem -Path "src" -Filter "*.ts" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $newContent = $content -replace "from '../../shared/schema'", "from '../schema'"
    $newContent = $newContent -replace 'from "../../shared/schema"', 'from "../schema"'
    
    if ($content -ne $newContent) {
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Fixed: $($_.FullName)" -ForegroundColor Green
        $count++
    }
}

Get-ChildItem -Path "scripts" -Filter "*.ts" -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $newContent = $content -replace "from '../../shared/schema'", "from '../schema'"
    $newContent = $newContent -replace 'from "../../shared/schema"', 'from "../schema"'
    
    if ($content -ne $newContent) {
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Fixed: $($_.FullName)" -ForegroundColor Green
        $count++
    }
}

Write-Host ""
Write-Host "Done! Fixed $count files" -ForegroundColor Green
