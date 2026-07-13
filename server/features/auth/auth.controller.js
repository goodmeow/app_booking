import { authenticateCredentials, publicPrincipal, registerEmployee, signPrincipalToken, validateDoorCard } from "./auth.service.js";

export const signin = async (req, res, next) => {
  try {
    const principal = await authenticateCredentials(req.body.email || req.body.username, req.body.password);
    const token = signPrincipalToken(principal);
    res.cookie("t", token, {
      httpOnly: true,
      secure: req.secure,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ token, user: publicPrincipal(principal) });
  } catch (error) {
    next(error);
  }
};

export const signup = async (req, res, next) => {
  try {
    await registerEmployee(req.body);
    res.status(201).json({ message: "Successfully signed up!" });
  } catch (error) {
    next(error);
  }
};

export const signout = (req, res) => {
  res.clearCookie("t", { httpOnly: true, sameSite: "lax" });
  res.json({ message: "signed out" });
};

export const doorOpen = async (req, res, next) => {
  try {
    await validateDoorCard(req.body.card_number);
    res.json({ message: "Door opened" });
  } catch (error) {
    next(error);
  }
};
