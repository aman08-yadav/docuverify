$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

if (-not (Test-Path './package.json') -or -not (Test-Path './render.yaml')) {
  throw 'Run this script from the extracted DocuVerify project folder; package.json and render.yaml must be in this folder.'
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git is not installed. Install Git for Windows, reopen PowerShell, and run this script again.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host 'GitHub CLI is required so you can securely authorize in your browser (no password/token needs to be pasted here).' -ForegroundColor Yellow
  Write-Host 'Install it using: winget install --id GitHub.cli -e'
  Write-Host 'Then close/reopen PowerShell and run this script again.'
  exit 1
}

try {
  gh auth status *> $null
} catch {
  # gh on some versions reports authentication failure via a non-zero exit code.
}
if ($LASTEXITCODE -ne 0) {
  Write-Host 'A browser window will open for GitHub authorization. Complete it there.' -ForegroundColor Cyan
  gh auth login --web --git-protocol https
  if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication did not complete.' }
}

$owner = (gh api user --jq .login).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($owner)) { throw 'Could not verify the GitHub account.' }

$repo = 'docuverify'
while ($true) {
  gh repo view "$owner/$repo" --json name --jq .name *> $null
  if ($LASTEXITCODE -ne 0) { break }
  $repo = Read-Host "GitHub repository '$owner/$repo' already exists. Enter another repository name"
  if ([string]::IsNullOrWhiteSpace($repo)) { throw 'Repository name cannot be blank.' }
  if ($repo -notmatch '^[A-Za-z0-9._-]+$') { throw 'Use only letters, numbers, dot, underscore, or dash for the repository name.' }
}

if (-not (Test-Path './.git')) { git init -b main }
if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the Git repository.' }

$existingName = git config --local user.name 2>$null
if ([string]::IsNullOrWhiteSpace($existingName)) { git config --local user.name $owner }
$existingEmail = git config --local user.email 2>$null
if ([string]::IsNullOrWhiteSpace($existingEmail)) {
  $noreply = (gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"').Trim()
  git config --local user.email $noreply
}

git add --all
if ($LASTEXITCODE -ne 0) { throw 'Could not stage the project files.' }
$stagedFiles = git diff --cached --name-only
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect staged files.' }
if ($stagedFiles) {
  git commit -m 'Prepare DocuVerify deployment'
  if ($LASTEXITCODE -ne 0) { throw 'Git commit failed.' }
}

$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($remote)) {
  if ($remote -notmatch [regex]::Escape("github.com/$owner/$repo")) {
    throw "This folder already has another origin remote ('$remote'). For safety, no remote was changed."
  }
} else {
  gh repo create "$owner/$repo" --private --description 'DocuVerify: OCR document review and explainable scholarship eligibility demo'
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the GitHub repository. Check the GitHub CLI message above.' }
  git remote add origin "https://github.com/$owner/$repo.git"
  if ($LASTEXITCODE -ne 0) { throw 'Could not configure the Git remote.' }
}

git branch -M main
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'GitHub push failed. Check the message above; no hosting deployment is claimed.' }

Write-Host ''
Write-Host 'SUCCESS: Project source was pushed to GitHub.' -ForegroundColor Green
Write-Host "Repository: https://github.com/$owner/$repo"
Write-Host ''
Write-Host 'Next: finish the managed services using DEPLOYMENT_CHECKLIST.md.' -ForegroundColor Cyan
Write-Host '1. MongoDB Atlas: create a cluster/database user and keep the connection string private.'
Write-Host '2. Render: New > Blueprint, select this repo, then set MONGODB_URI and CLIENT_ORIGIN.'
Write-Host '3. Vercel: import this repo from the repository root; set VITE_API_URL to the Render API URL ending in /api.'
Write-Host '4. Update Render CLIENT_ORIGIN to the final Vercel origin, redeploy, and test /api/health and sign-in.'
Write-Host 'This script publishes source only; it does not claim that the app is live until hosted services are configured and smoke-tested.'

Start-Process 'https://cloud.mongodb.com/'
Start-Process 'https://dashboard.render.com/blueprints'
Start-Process 'https://vercel.com/new'
