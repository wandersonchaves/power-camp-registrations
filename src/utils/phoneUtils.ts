export const sanitizePhoneNumber = (phone?: string): string | null => {
  if (typeof phone !== "string" || phone.trim() === "") {
    console.error("sanitizePhoneNumber: Invalid phone number provided:", phone);
    return null;
  }

  const sanitized = phone.replace(/\D/g, "");

  const isValid = /^[1-9]{2}9?[0-9]{8}$/.test(sanitized);

  return isValid ? sanitized : null;
};
