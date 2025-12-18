import express from "express";
import auth from "../middleware/auth.js";
import {
    createRequest,
    getMyRequests,
    updateRequest,
    deleteRequest,
    getOtherRequests,
    markInterest
} from "../controller/bloodRequestController.js";

const router = express.Router();

router.post("/", auth, createRequest);
router.get("/mine", auth, getMyRequests);
router.put("/:id", auth, updateRequest);
router.delete("/:id", auth, deleteRequest);

router.get("/others", auth, getOtherRequests);
router.post("/interest/:id", auth, markInterest);

export default router;
