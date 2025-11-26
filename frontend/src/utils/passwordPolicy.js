const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const passwordPolicy = {
  regex: PASSWORD_REGEX,
  message:
    'A senha precisa ter no mínimo 8 caracteres, incluindo letra maiúscula, letra minúscula, número e caractere especial.'
};

export const isPasswordCompliant = (value) => PASSWORD_REGEX.test(value ?? '');
export const passwordPattern = PASSWORD_REGEX.source;
