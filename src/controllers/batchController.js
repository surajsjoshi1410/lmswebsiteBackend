//src/controllers/batchController.js
const mongoose = require("mongoose");
const { error } = require("winston");
const Batch = require("../models/batchModel");
const Student = require("../models/studentModel");

exports.createBatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      batch_name,
      batch_image, // Expected to be a string (URL or file path)
      subject_id,
      class_id,
      teacher_id,
      students, // Array of student IDs
      date,
      type_of_batch
    } = req.body;

    // Validate required fields
    if (
      !batch_name ||
      !subject_id ||
      !class_id ||
      !teacher_id ||
      !students ||
      !date||
      !type_of_batch
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "All fields are required" });
    }

    // Ensure 'students' is an array
    if (!Array.isArray(students)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "'students' must be an array of student IDs" });
    }

    // Validate all student IDs
    const validStudentsCount = await Student.countDocuments({ _id: { $in: students } });
    if (validStudentsCount !== students.length) {
      throw new Error("One or more student IDs are invalid");
    }

    // Create the new Batch
    const newBatch = new Batch({
      batch_name,
      batch_image,
      subject_id,
      class_id,
      teacher_id,
      students,
      date,
      type_of_batch
    });

    await newBatch.save({ session });

    // Prepare the update for students using $addToSet to prevent duplicates
    const bulkOps = students.map((studentId) => ({
      updateOne: {
        filter: { _id: studentId },
        update: {
          $addToSet: {
            batch_creation: {
              subject_id: subject_id,
              status: true,
            },
          },
        },
      },
    }));

    // Execute bulk operations
    const bulkWriteResult = await Student.bulkWrite(bulkOps, { session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: "Batch created successfully" });
  } catch (error) {
    // Abort the transaction in case of error
    await session.abortTransaction();
    session.endSession();

    console.error("Error creating batch:", error);

    // Handle specific errors if necessary
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    res.status(500).json({ error: error.message || "Server error" });
  }
};

// src/controllers/batchController.js

exports.getAllBatches = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      teacher_id,
      students,
      sort_by,
      page = 1,
      limit = 100,
    } = req.query;

    // Build a query object
    let query = {};

    // Filter by date range
    if (start_date && end_date) {
      query.start_date = {
        $gte: new Date(start_date),
        $lte: new Date(end_date),
      };
    } else if (start_date) {
      query.start_date = { $gte: new Date(start_date) };
    } else if (end_date) {
      query.start_date = { $lte: new Date(end_date) };
    }

    // Filter by teacher_id and students
    if (teacher_id) {
      query.teacher_id = teacher_id;
    }
    if (students) {
      query.students = students;
    }

    // Build sort object
    let sort = {};
    if (sort_by === "newest") {
      sort.date = -1;
    } else if (sort_by === "oldest") {
      sort.date = 1;
    } else if (sort_by === "start_date_asc") {
      sort.start_date = 1;
    } else if (sort_by === "start_date_desc") {
      sort.start_date = -1;
    }

    // Pagination options with nested population for user details in teacher and students
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sort,
      populate: [
        {
          path: "teacher_id",
          populate: { path: "user_id", select: "name email" },
        },
        {
          path: "students",
          populate: { path: "user_id", select: "name email" },
        },
        {
          path: "subject_id",
          populate: { path: "_id", select: "subject_name" },
        },
        {
          path: "class_id",
          populate: { path: "_id", select: "className classLevel curriculum" },
        },
      ],
    };

    // Execute the query with pagination
    const batches = await Batch.paginate(query, options);

    // Modify the batch response to include student count
    const modifiedBatches = batches.docs.map((batch) => ({
      ...batch.toObject(), // Convert Mongoose document to plain JS object
      studentcount: batch.students ? batch.students.length : 0, // Add student count
    }));

    res.status(200).json({
      message: "Batches fetched successfully",
      batches: modifiedBatches,
      totalPages: batches.totalPages,
      currentPage: batches.page,
    });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Controller function to get all batches without pagination
exports.getAllBatchesNoFilter = async (req, res) => {
  try {
    // Fetch all batches and populate the teacher and students
    const batches = await Batch.find()
      .populate({ path: "teacher_id", select: "user_id.name " })
      // .populate({ path: "students", select: "name email" })
      .sort({ start_date: 1 }); // Sort by start_date ascending

    res.status(200).json({
      success: true,
      message: "Batches fetched successfully",
      data: batches,
    });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch batches",
      error: error.message,
    });
  }
};

exports.getBatchesByTeacherId = async (req, res) => {
  try {
    // Check if the user's role is 'teacher'
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Access denied: Not a teacher" });
    }

    // const teacherId = req.user._id; // Use authenticated user's ID
    const teacherId = req.params.teacherId;

    // Find batches where the teacher ID matches
    const batches = await Batch.find({ teacher_id: teacherId })
      .populate("students") // Populate students details if needed
      .populate("subject_id")
      .populate("class_id")
      .populate({
        path: "teacher_id",
        populate: { path: "user_id", select: "name email" },
      })
      .exec();

    // Check if any batches are found
    if (!batches || batches.length === 0) {
      return res
        .status(404)
        .json({ message: "No batches found for this teacher" });
    }

    // Send the found batches as a response
    res.status(200).json(batches);
  } catch (error) {
    // Handle errors
    res.status(500).json({ message: "Server error", error });
  }
};




/**
 * Controller function to get a single batch by its ID
// */
exports.getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the presence of the batch ID
    if (!id) {
      return res.status(400).json({ message: "Batch ID is required" });
    }

    // Find the batch by ID and populate related fields
    const batch = await Batch.findById(id)
      .populate({
        path: "teacher_id",
        populate: { path: "user_id", select: "name email" },
      })
      .populate({
        path: "students",
        populate: { path: "user_id", select: "name email" },
      })
      .populate({
        path: "subject_id",
        select: "subject_name",
      })
      .populate({
        path: "class_id",
        select: "className classLevel curriculum",
      });

    // If the batch is not found, return a 404 error
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Convert the Mongoose document to a plain JavaScript object
    const batchObj = batch.toObject();

    // Add a student count to the batch object
    batchObj.studentcount = batch.students ? batch.students.length : 0;

    // Respond with the batch details
    res.status(200).json({
      message: "Batch fetched successfully",
      batch: batchObj,
    });
  } catch (error) {
    console.error("Error fetching batch:", error);
    res.status(500).json({ error: "Server error" });
  }
};

//  get bathes by student id
exports.getBatchesByStudentId = async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Find batches where the student ID is in the students array
    const batches = await Batch.find({ students: studentId })
      .populate({
        path: "teacher_id",
        populate: { path: "user_id", select: "name email" },
      })
      .populate("subject_id")
      .populate("class_id")
      .populate({
        path: "students",
        populate: { path: "user_id", select: "name email" },
      })
      .exec();

    // Send the found batches as a response
    res.status(200).json(batches);
  } catch (error) {
    // Handle errors
    res.status(500).json({ message: "Server error", error });
  }
};

// // Get batches by authenticated teacher ID
// exports.getBatchesByTeacherId = async (req, res) => {
//   try {
//     // Check if the user's role is 'teacher'
//     if (req.user.role !== "teacher") {
//       return res.status(403).json({ message: "Access denied: Not a teacher" });
//     }

//     // const teacherId = req.user._id; // Use authenticated user's ID
//     const teacherId = req.params.teacherId;

//     // Find batches where the teacher ID matches
//     const batches = await Batch.find({ teacher_id: teacherId })
//       .populate("students") // Populate students details if needed
//       .exec();

//     // Check if any batches are found
//     if (!batches || batches.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No batches found for this teacher" });
//     }

//     // Send the found batches as a response
//     res.status(200).json(batches);
//   } catch (error) {
//     // Handle errors
//     res.status(500).json({ message: "Server error", error });
//   }
// };
