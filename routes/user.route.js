import { Router } from "express";
import {
  registerUser,
  loginUser,
  fetchLoginUser,
  updateUser,
  getAllUsers,
  revealContact,
  deleteUser,
  updatePushToken,
} from "../controller/user.controller.js";
import auth from "../middleware/auth.js";
const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", fetchLoginUser);
router.put("/update", updateUser);
router.put("/update-token", auth, updatePushToken);
router.get("/users", getAllUsers);
router.delete("/delete", deleteUser);
router.get("/reveal-contact/:id", revealContact); 
export default router;
