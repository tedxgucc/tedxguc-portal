# Asks for the Resend API key (hidden) and the sender address, and saves them as Supabase secrets.
# The key never appears on screen or in this file.
$secure = Read-Host -Prompt 'Paste your Resend API key (starts with re_) and press Enter' -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim().Trim('"', "'")
if (-not $key.StartsWith('re_') -or $key -match '\s') {
  Write-Host 'That does not look like a Resend API key. It should start with re_ and have no spaces. Create one at resend.com/api-keys' -ForegroundColor Red
  exit 1
}
$from = Read-Host -Prompt 'Sender address on your verified domain (for example tickets@tedxguc.com)'
$from = $from.Trim()
if ($from -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { Write-Host 'That is not an email address.' -ForegroundColor Red; exit 1 }
npx.cmd supabase secrets set "RESEND_API_KEY=$key" "EMAIL_FROM=TEDxGUC <$from>" --project-ref qqgnvrjqrxafskkwxsvc
if ($LASTEXITCODE -eq 0) { Write-Host 'Saved. Tell Claude "Email key set" so it can send a test email.' -ForegroundColor Green }
