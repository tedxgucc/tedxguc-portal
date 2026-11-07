# Asks for the Gemini API key (hidden) and saves it as a Supabase secret.
$secure = Read-Host -Prompt 'Paste your Gemini API key (starts with AIza or AQ.) and press Enter' -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim().Trim('"', "'")
if (-not ($key.StartsWith('AIza') -or $key.StartsWith('AQ.')) -or $key -match '\s') {
  Write-Host 'That does not look like a Gemini API key. It should start with AIza or AQ. and have no spaces. Get one at aistudio.google.com/apikey' -ForegroundColor Red
  exit 1
}
npx.cmd supabase secrets set "GEMINI_API_KEY=$key" --project-ref qqgnvrjqrxafskkwxsvc
if ($LASTEXITCODE -eq 0) { Write-Host 'Saved. Try Draft with AI again.' -ForegroundColor Green }
