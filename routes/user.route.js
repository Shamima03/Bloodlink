import { Router } from "express";
import {
  registerUser,
  loginUser,
  fetchLoginUser,
  updateUser,
  getAllUsers,
  deleteUser,
} from "../controller/user.controller.js";
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", fetchLoginUser);
router.put("/update", updateUser);
router.get("/users", getAllUsers);
router.delete("/delete", deleteUser);

export default router;
