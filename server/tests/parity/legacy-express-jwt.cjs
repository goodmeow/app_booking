const jwt = require("jsonwebtoken");

module.exports = ({ secret, userProperty = "user" }) => (req, res, next) => {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!match) {
    const error = new Error("No authorization token was found");
    error.status = 401;
    error.name = "UnauthorizedError";
    return next(error);
  }
  try {
    req[userProperty] = jwt.verify(match[1], secret);
    next();
  } catch (cause) {
    const error = new Error("invalid token");
    error.status = 401;
    error.name = "UnauthorizedError";
    error.inner = cause;
    next(error);
  }
};
