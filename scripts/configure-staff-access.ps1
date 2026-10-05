$ErrorActionPreference = 'Stop'
$target = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../outputs/staff-access.env'))
Write-Host 'FRAGUAN - credenciales de produccion para Railway'
Write-Host 'La contrasena debe tener al menos 12 caracteres. No se mostrara ni guardara en texto plano.'
$securePassword = Read-Host 'Nueva contrasena del propietario' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  if ($password.Length -lt 12 -or $password.Length -gt 128) { throw 'Usa entre 12 y 128 caracteres.' }
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  $saltBytes = New-Object byte[] 16
  $random.GetBytes($saltBytes)
  $salt = ([BitConverter]::ToString($saltBytes)).Replace('-', '').ToLowerInvariant()
  $derive = [Security.Cryptography.Rfc2898DeriveBytes]::new($password,
    [Text.Encoding]::UTF8.GetBytes($salt), 600000, [Security.Cryptography.HashAlgorithmName]::SHA256)
  $hash = ([BitConverter]::ToString($derive.GetBytes(32))).Replace('-', '').ToLowerInvariant()
  $derive.Dispose()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $password = $null
  $securePassword.Dispose()
}
$securePin = Read-Host 'Nuevo PIN de Administracion (6 digitos, diferente del PIN local)' -AsSecureString
$pinPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePin)
try {
  $pin = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pinPointer)
  if ($pin -notmatch '^\d{6}$' -or $pin -eq '197313' -or $pin -match '^(\d)\1{5}$') {
    throw 'Elige un PIN de 6 digitos que no sea el local ni seis digitos iguales.'
  }
  $sessionBytes = New-Object byte[] 32
  $adminBytes = New-Object byte[] 32
  $random.GetBytes($sessionBytes)
  $random.GetBytes($adminBytes)
  $values = @(
    "INTERNAL_PASSWORD_HASH=pbkdf2-sha256:600000:${salt}:${hash}"
    "INTERNAL_SESSION_SECRET=$([Convert]::ToBase64String($sessionBytes))"
    "ADMIN_SESSION_SECRET=$([Convert]::ToBase64String($adminBytes))"
    "ADMIN_PIN=$pin"
    'INTERNAL_AUTH_TRUST_PROXY=false'
  )
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
  [IO.File]::WriteAllLines($target, $values, [Text.UTF8Encoding]::new($false))
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pinPointer)
  $pin = $null
  $securePin.Dispose()
  $random.Dispose()
}
Write-Host "Archivo privado creado: $target"
Write-Host 'En Railway, fraguan-store-api > Variables > Raw Editor, AGREGA esas lineas sin borrar las variables existentes.'
Write-Host 'Usa el email del propietario existente del negocio para ingresar. No pegues estas claves en el chat.'
