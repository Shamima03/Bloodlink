import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";

// ----------------------------
// Create Blood Request
// ----------------------------
export const createRequest = async (req, res) => {
    try {
        const data = { ...req.body, user: req.user.id };
        const request = await BloodRequest.create(data);

        res.status(201).json({ message: "Request created", request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----------------------------
// Get My Requests
// ----------------------------
export const getMyRequests = async (req, res) => {
    try {
        // const requests = await BloodRequest.find({ user: req.user.id });
        const requests = await BloodRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----------------------------
// Edit My Request
// ----------------------------
export const updateRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    if (request.isCompleted && !("isCompleted" in req.body)) {
      return res
        .status(400)
        .json({ message: "Completed requests cannot be edited" });
    }

    Object.assign(request, req.body);
    await request.save();

    res.json({ message: "Request updated", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ----------------------------
// Delete My Request
// ----------------------------
export const deleteRequest = async (req, res) => {
    try {
        const request = await BloodRequest.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!request)
            return res.status(404).json({ message: "Request not found or unauthorized" });

        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----------------------------
// Get All Other Users’ Requests
// ----------------------------
export const getOtherRequests = async (req, res) => {
  try {
    const requests = await BloodRequest.find({
      isCompleted: false   // ✅ ONLY hide completed
    })
    .populate("user", "name")
    .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------------
// Click Interest Icon
// ----------------------------
export const markInterest = async (req, res) => {
    try {
        const request = await BloodRequest.findById(req.params.id);

        if (!request)
            return res.status(404).json({ message: "Request not found" });

        if (String(request.user) === req.user.id)
            return res.status(400).json({ message: "You cannot show interest on your own post" });

        if (request.interests.includes(req.user.id))
            return res.status(400).json({ message: "You already showed interest" });

        request.interests.push(req.user.id);
        await request.save();

        // Create Notification
        await Notification.create({
            toUser: request.user,
            fromUser: req.user.id,
            message: `Someone shared interest on your blood request.`
        });

        res.json({ message: "Interest added", request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
