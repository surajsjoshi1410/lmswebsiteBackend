const mongoose = require("mongoose");
const Student = require("../models/studentModel");
const Class = require("../models/classModel");
const Package = require("../models/packagesModel");
const Subject = require("../models/subjectModel");

// Create Student Controller
exports.createStudent = async (req, res) => {
  try {
    const { auth_id, user_id, student_id, role } = req.body;

    // Validate role
    if (!["student", "admin"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Invalid role. Must be student or admin." });
    }

    // Validate ObjectId for student_id
    if (!mongoose.Types.ObjectId.isValid(student_id)) {
      return res.status(400).json({ error: "Invalid student_id format." });
    }

    // Check if auth_id or student_id already exists
    const existingStudent = await Student.findOne({
      $or: [{ auth_id }, { student_id }],
    });

    if (existingStudent) {
      return res.status(409).json({
        error: "Student with this auth_id or student_id already exists.",
      });
    }

    // Create new student
    const newStudent = new Student({
      auth_id,
      student_id: new mongoose.Types.ObjectId(student_id), // Use 'new' correctly
      user_id: new mongoose.Types.ObjectId(user_id),
      role,
    });

    const savedStudent = await newStudent.save();
    res.status(201).json({
      message: "Student created successfully",
      student: savedStudent,
    });
  } catch (error) {
    console.error("Error creating student:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get student by ID
exports.getStudentById = async (req, res) => {
  const { id } = req.params;

  // Validate if ID is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid student ID format." });
  }

  try {
    const student = await Student.findById( id )
    .populate('user_id', 'name email') // Populate user details excluding sensitive fields  
    .populate('class', 'className classLevel')// Example: populate class details
    .populate('subject_id', 'subject_name') // Example: populate subject details
    .populate('board_id', 'name'); // Populate user data

    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    res.status(200).json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get all students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find().populate({
      path: "user_id",
      select: "name email mobile_number role", // Specify fields to return
    })
    .populate('board_id')
    .populate('class'); // Populate user data
    res.status(200).json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a student by ID
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;

  // Validate if ID is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid student ID format." });
  }

  try {
    const deletedStudent = await Student.findOneAndDelete({ student_id: id });

    if (!deletedStudent) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Controller to get the number of students subscribed and not subscribed
exports.getStudentSubscriptionStats = async (req, res) => {
  try {
    // Count students who are subscribed (is_paid: true)
    const subscribedCount = await Student.countDocuments({ is_paid: true });

    // Count students who are not subscribed (is_paid: false)
    const notSubscribedCount = await Student.countDocuments({ is_paid: false });

    // Prepare response data
    const responseData = {
      subscribed: subscribedCount,
      notSubscribed: notSubscribedCount,
    };

    // Send response
    res.status(200).json({
      message: "Student subscription statistics fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching student subscription statistics:", error);
    res.status(500).json({ error: "Server error" });
  }
};
exports.getStudentsBySubjectAndClassId = async (req, res) => {
  try {
    const { subject_id, class_id } = req.params; // Extract subject_id and class_id from URL parameters

    // Find students with the matching subject_id and class_id
    const students = await Student.find({
      subject_id: subject_id, // Match subject_id in the subject_id array
      class: class_id, // Match class_id in the class object
    })
      .populate("user_id", "name email") // Populate user details if needed
      .populate("subject_id", "subject_name"); // Populate subject details if needed
    //   .populate("class_id", "name classLevel"); // Populate class details if needed

    if (!students || students.length === 0) {
      return res
        .status(404)
        .json({ error: "No students found for this subject and class" });
    }

    res.status(200).json(students);
  } catch (error) {
    console.error("Error fetching students by subject and class:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getPaymentStatusChartData = async (req, res) => {
  try {
    let { year, month, day } = req.query; // Extract year, month, and day from query parameters

    const matchConditions = {};
    year = year ? parseInt(year) : null;
    month = month ? parseInt(month) : null;
    day = day ? parseInt(day) : null;

    // Build the date filter conditions based on query parameters
    if (year && month && day) {
      matchConditions.created_at = {
        $gte: new Date(`${year}-${month}-${day}`),
        $lt: new Date(`${year}-${month}-${day + 1}`),
      };
    } else if (year && month) {
      matchConditions.created_at = {
        $gte: new Date(`${year}-${month}-01`),
        $lt: new Date(`${year}-${month + 1}-01`),
      };
    } else if (year) {
      matchConditions.created_at = {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`),
      };
    } else if (month) {
      matchConditions.created_at = {
        $gte: new Date(`1970-${month}-01`), // Use a dummy year
        $lt: new Date(`2300-${month + 1}-01`),
      };
    }

    // Query to aggregate student data by creation date
    const studentsData = await Student.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: {
            $cond: [
              { $and: [year, month, day] },
              { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
              {
                $cond: [
                  { $and: [year, month] },
                  {
                    $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
                  },
                  {
                    $cond: [
                      year,
                      {
                        $dateToString: { format: "%Y-%m", date: "$created_at" },
                      },
                      { $dateToString: { format: "%m", date: "$created_at" } },
                    ],
                  },
                ],
              },
            ],
          },
          paidCount: { $sum: { $cond: ["$is_paid", 1, 0] } },
          unpaidCount: { $sum: { $cond: ["$is_paid", 0, 1] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Prepare response data
    const xData = studentsData.map((item) => item._id); // Extract date labels
    const yData = studentsData.map((item) => ({
      paid: item.paidCount,
      unpaid: item.unpaidCount,
    }));

    // Send response
    res.status(200).json({
      message: "Chart data fetched successfully",
      xData,
      yData,
    });
  } catch (error) {
    console.error("Error fetching payment status chart data:", error);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Update a student by ID and update their class by class_id.
 * @param {Object} req - The request object containing params and body.
 * @param {Object} res - The response object to send the result.
 */
exports.updateStudent = async (req, res) => {
  const { studentId } = req.params; // Get student ID from route params
  const { class_id, ...updateData } = req.body; // Extract class_id and other update data

  try {
    // Find the student by ID
    let student = await Student.findOne({ user_id: studentId });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // If class_id is provided, find the class in the Class collection
    if (class_id) {
      const classInfo = await Class.findById(class_id);
      if (!classInfo) {
        return res.status(404).json({ error: "Class not found" });
      }

      // Update the class information in the student document
      student.class = {
        _id: classInfo._id,
        name: classInfo.className,
        classLevel: classInfo.classLevel,
      };
    }

    // Update other fields only if provided in the request body
    student.auth_id = updateData.auth_id || student.auth_id;
    student.student_id = updateData.student_id || student.student_id;
    student.user_id = updateData.user_id || student.user_id;
    student.subscribed_Package =
      updateData.subscribed_Package || student.subscribed_Package;
    student.is_paid =
      updateData.is_paid !== undefined ? updateData.is_paid : student.is_paid;
    student.subscription_id =
      updateData.subscription_id || student.subscription_id;
    student.payment_id = updateData.payment_id || student.payment_id;
    student.last_online = updateData.last_online || student.last_online;
    student.phone_number = updateData.phone_number || student.phone_number;

    // Save the updated student
    const updatedStudent = await student.save();

    res.status(200).json({
      message: "Student updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getStudentByAuthId= async (req,res)=>{
  try{
    const authId = req.headers['auth_id']; // Extract auth_id from headers

    if (!authId) {
      return res.status(400).json({ message: 'auth_id header is required' });
    }

    const student = await Student.findOne({ auth_id: authId })
    .populate('user_id', 'name email') // Populate user details excluding sensitive fields  
    .populate('class', 'className classLevel')// Example: populate class details
    .populate('subject_id', 'subject_name') // Example: populate subject details
    .populate('board_id', 'name') // Example: populate board details
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.status(200).json({
      message: 'Student retrieved successfully by auth_id', 
      student,
    })
  
  }catch(error){
    console.error('Error fetching student by auth_id:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

exports.getStudentsByClassId = async (req, res) => {
  try {
    const { class_id } = req.params; // Extract class_id from URL parameters

    // Validate if class_id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(class_id)) {
      return res.status(400).json({ error: "Invalid class ID format." });
    }

    // Find students with the matching class_id
    const students = await Student.find({ 'class': class_id })
      .populate('user_id', 'name email') // Populate user details if needed
      .populate('class', 'className classLevel'); // Populate class details if needed

    if (!students || students.length === 0) {
      return res.status(404).json({ error: "No students found for this class" });
    }

    res.status(200).json({
      message: "Students retrieved successfully",
      students,
    });
  } catch (error) {
    console.error("Error fetching students by class:", error);
    res.status(500).json({ error: "Server error" });
  }
};


// Controller to get students by subject
exports.getStudentsforBatchBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    // Validate subjectId
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    // Step 1: Verify that the subject exists
    const subjectExists = await Subject.exists({ _id: subjectId });
    if (!subjectExists) {
      return res.status(404).json({ error: "Subject not found" });
    }

    // Step 2: Find all packages that include the given subjectId
    const packagesWithSubject = await Package.find({
      subject_id: subjectId,
      // is_active: true, // Optionally filter active packages
    }).select("_id");

    if (!packagesWithSubject.length) {
      return res.status(404).json({ message: "No packages found for this subject" });
    }

    const packageIds = packagesWithSubject.map(pkg => pkg._id);

    // Step 3: Find all students who have subscribed to these packages,
    // have paid, and either do not have the subject in batch_creation
    // or have it with status: false
    const students = await Student.find({
      subscribed_Package: { $in: packageIds },
      is_paid: true,
      $or: [
        { batch_creation: { $exists: false } }, // No batch_creation field
        { batch_creation: { $size: 0 } }, // Empty batch_creation array
        {
          batch_creation: {
            $not: {
              $elemMatch: { subject_id: subjectId, status: true }
            }
          }
        }
      ]
    })
    .populate("user_id", "name email phone_number") // Populate user details
    .populate("subscribed_Package", "package_name"); // Populate package details

    if (!students.length) {
      return res.status(404).json({ message: "No eligible students found for this subject" });
    }

    res.status(200).json({
      message: "Students retrieved successfully",
      data: students,
    });

  } catch (error) {
    console.error("Error fetching students by subject:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};