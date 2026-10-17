$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker não foi encontrado. Instale Docker Desktop antes de continuar.'
}

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
$exampleFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env.example'
if (-not (Test-Path $envFile)) {
  Copy-Item $exampleFile $envFile
  throw 'Arquivo .env criado a partir do modelo. Configure POSTGRES_PASSWORD, GESTOR_BOOTSTRAP_EMAIL e GESTOR_BOOTSTRAP_PASSWORD e execute novamente.'
}

$settings = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#\s][^=]*)\s*=\s*(.*)\s*$') {
    $settings[$matches[1]] = $matches[2].Trim('"').Trim("'")
  }
}

if ([string]::IsNullOrWhiteSpace($settings.POSTGRES_PASSWORD) -or $settings.POSTGRES_PASSWORD.Length -lt 24) {
  throw 'POSTGRES_PASSWORD deve estar definido e possuir pelo menos 24 caracteres.'
}
if ([string]::IsNullOrWhiteSpace($settings.GESTOR_BOOTSTRAP_EMAIL) -or
    [string]::IsNullOrWhiteSpace($settings.GESTOR_BOOTSTRAP_PASSWORD) -or
    $settings.GESTOR_BOOTSTRAP_PASSWORD.Length -lt 16) {
  throw 'Defina GESTOR_BOOTSTRAP_EMAIL e uma GESTOR_BOOTSTRAP_PASSWORD com pelo menos 16 caracteres no .env.'
}

$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  docker compose up --build -d
  if ($LASTEXITCODE -ne 0) { throw 'docker compose up falhou.' }
  docker compose ps
  $healthUrl = 'http://localhost:3001/api/health'
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
      if ($health.status -eq 'ok' -and $health.database -eq 'connected') {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if (-not $ready) { throw 'A API não ficou pronta. Consulte docker compose logs app db.' }
  Write-Output 'Deploy local pronto: http://localhost:3001/usuario/ e http://localhost:3001/gestor/'
} finally {
  Pop-Location
}
