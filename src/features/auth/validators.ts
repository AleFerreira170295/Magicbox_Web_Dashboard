type ValidationMessageOptions = {
  requiredField?: string;
  requiredEmail?: string;
  invalidEmail?: string;
  requiredName?: string;
  nameMinLength?: string;
  nameLettersOnly?: string;
  requiredPassword?: string;
  passwordLength?: string;
  passwordNoSpaces?: string;
  passwordUppercase?: string;
  passwordLowercase?: string;
  passwordNumber?: string;
  passwordSpecial?: string;
  passwordCommon?: string;
  passwordRepeats?: string;
  passwordSequence?: string;
  requiredPasswordConfirmation?: string;
  passwordMismatch?: string;
  requiredOtp?: string;
  otpLength?: string;
  otpNumbersOnly?: string;
  requiredPhone?: string;
  phoneLength?: string;
};

export function requiredField(value: string | null | undefined, message = "Campo requerido") {
  if (value == null || value.trim().length === 0) {
    return message;
  }
  return null;
}

export function validateEmail(value: string | null | undefined, options: ValidationMessageOptions = {}) {
  const required = requiredField(value, options.requiredEmail ?? "Ingresá tu email");
  if (required) return required;

  const email = value!.trim();
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) ? true : (options.invalidEmail ?? "Ingresá un email válido");
}

export function validateName(value: string | null | undefined, options: ValidationMessageOptions = {}) {
  const required = requiredField(value, options.requiredName ?? "Ingresa tu nombre");
  if (required) return required;

  const name = value!.trim();
  if (name.length < 2) return options.nameMinLength ?? "El nombre debe tener al menos 2 caracteres";
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(name)) {
    return options.nameLettersOnly ?? "El nombre solo puede contener letras y espacios";
  }
  return true;
}

export function validateSecureBackendPassword(value: string | null | undefined, options: ValidationMessageOptions = {}) {
  const required = requiredField(value, options.requiredPassword ?? "Ingresa tu contraseña");
  if (required) return required;

  const password = value!;
  if (password.length < 8 || password.length > 128) {
    return options.passwordLength ?? "Debe tener entre 8 y 128 caracteres";
  }
  if (/\s/.test(password)) {
    return options.passwordNoSpaces ?? "No puede contener espacios";
  }
  if (!/[A-Z]/.test(password)) {
    return options.passwordUppercase ?? "Debe contener al menos una mayúscula";
  }
  if (!/[a-z]/.test(password)) {
    return options.passwordLowercase ?? "Debe contener al menos una minúscula";
  }
  if (!/[0-9]/.test(password)) {
    return options.passwordNumber ?? "Debe contener al menos un número";
  }
  if (!/[!@#$%^&*(),.?\":{}|<>_\-+=/\\[\]`~;]/.test(password)) {
    return options.passwordSpecial ?? "Debe contener al menos un carácter especial";
  }

  const lower = password.toLowerCase();
  const weakPatterns = ["password", "qwerty", "123456", "abc123", "admin", "welcome", "letmein", "111111"];
  if (weakPatterns.some((pattern) => lower.includes(pattern))) {
    return options.passwordCommon ?? "La contraseña es demasiado común";
  }
  if (/(.)\1{3,}/.test(password)) {
    return options.passwordRepeats ?? "Evita repeticiones de caracteres";
  }
  if (/(0123|1234|2345|3456|4567|5678|6789|7890)/.test(lower) || /(abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl)/.test(lower)) {
    return options.passwordSequence ?? "Evita secuencias simples";
  }
  return true;
}

export function validatePasswordConfirmation(value: string | null | undefined, originalPassword: string, options: ValidationMessageOptions = {}) {
  const required = requiredField(value, options.requiredPasswordConfirmation ?? "Confirma tu contraseña");
  if (required) return required;
  if (value !== originalPassword) {
    return options.passwordMismatch ?? "Las contraseñas no coinciden";
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
  options: ValidationMessageOptions = {},
) {
  const required = requiredField(value, options.requiredPhone ?? "Ingresa tu teléfono");
  if (required) return required;

  const digits = normalizePhoneDigits(value!);
  if (digits.length < minDigits || digits.length > maxDigits) {
    const template = options.phoneLength ?? "El teléfono debe tener entre {{min}} y {{max}} dígitos para {{country}}";
    return template
      .replace("{{min}}", String(minDigits))
      .replace("{{max}}", String(maxDigits))
      .replace("{{country}}", countryName);
  }
  return true;
}
