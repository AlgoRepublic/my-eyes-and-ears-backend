const options = {
  abortEarly: false,
  errors: {
    wrap: {
      label: false,
    },
  },
};

const joiValidate = async (schema, property) => {
  return await schema.validate(property, options);
};

const joiFormatErrors = (error) => {
  if (!error || !error.details) return [];

  return error.details.reduce((acc, err) => {
    const field = err.path.join(".") || "field";
    const message = err.message;

    const existing = acc.find((e) => e.field === field);

    if (existing) {
      existing.messages.push(message);
    } else {
      acc.push({ field, messages: [message] });
    }

    return acc;
  }, []);
};

const joiError = (error) => {
  return error.details[0].message;
};

module.exports = {
  joiError,
  joiValidate,
  joiFormatErrors,
};
