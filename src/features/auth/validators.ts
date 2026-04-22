export function requiredField(value: string | null | undefined, message = "Campo requerido") {
  if (value == null || value.trim().length === 0) {
    return message;
  }
  return null;
}

export function validateEmail(value: string | null | undefined, message = "Ingresá un email válido") {
  const required = requiredField(value, "Ingresá tu email");
  if (required) return required;

  const email = value!.trim();
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) ? true : message;
}

export function validateName(value: string | null | undefined, message = "Nombre inválido") {
  const required = requiredField(value, "Ingresa tu nombre");
  if (required) return required;

  const name = value!.trim();
  if (name.length < 2) return "El nombre debe tener al menos 2 caracteres";
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(name)) {
    return "El nombre solo puede contener letras y espacios";
  }
  return true;
}

export function validateSecureBackendPassword(value: string | null | undefined) {
  const required = requiredField(value, "Ingresa tu contraseña");
  if (required) return required;

  const password = value!;
  if (password.length < 8 || password.length > 128) {
    return "Debe tener entre 8 y 128 caracteres";
  }
  if (/\s/.test(password)) {
    return "No puede contener espacios";
  }
  if (!/[A-Z]/.test(password)) {
    return "Debe contener al menos una mayúscula";
  }
  if (!/[a-z]/.test(password)) {
    return "Debe contener al menos una minúscula";
  }
  if (!/[0-9]/.test(password)) {
    return "Debe contener al menos un número";
  }
  if (!/[!@#$%^&*(),.?\":{}|<>_\-+=/\\[\]`~;]/.test(password)) {
    return "Debe contener al menos un carácter especial";
  }

  const lower = password.toLowerCase();
  const weakPatterns = ["password", "qwerty", "123456", "abc123", "admin", "welcome", "letmein", "111111"];
  if (weakPatterns.some((pattern) => lower.includes(pattern))) {
    return "La contraseña es demasiado común";
  }
  if (/(.)\1{3,}/.test(password)) {
    return "Evita repeticiones de caracteres";
  }
  if (/(0123|1234|2345|3456|4567|5678|6789|7890)/.test(lower) || /(abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl)/.test(lower)) {
    return "Evita secuencias simples";
  }
  return true;
}

export function validatePasswordConfirmation(value: string | null | undefined, originalPassword: string) {
  const required = requiredField(value, "Confirma tu contraseña");
  if (required) return required;
  if (value !== originalPassword) {
    return "Las contraseñas no coinciden";
  }
  return true;
}

export function validateOtp(value: string | null | undefined, length = 6) {
  const required = requiredField(value, "Ingresa el código");
  if (required) return required;

  const otp = value!.trim();
  if (otp.length !== length) {
    return `El código debe tener ${length} dígitos`;
  }
  if (!/^\d+$/.test(otp)) {
    return "El código solo puede contener números";
  }
  return true;
}

export function normalizePhoneDigits(value: string) {
  return value.replaceAll(/\D/g, "");
}

export function validatePhoneNumberForCountry(
  value: string | null | undefined,
  minDigits: number,
  maxDigits: number,
  countryName: string,
) {
  const required = requiredField(value, "Ingresa tu teléfono");
  if (required) return required;

  const digits = normalizePhoneDigits(value!);
  if (digits.length < minDigits || digits.length > maxDigits) {
    return `El teléfono debe tener entre ${minDigits} y ${maxDigits} dígitos para ${countryName}`;
  }
  return true;
}
