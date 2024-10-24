// src/controllers/statsController.js
const Teacher = require('../models/teacherModel'); // Adjust the path as necessary
const Student = require('../models/studentModel'); // Adjust the path as necessary
const Course = require('../models/courseModel'); // Adjust the path as necessary

exports.getStatistics = async (req, res) => {
    try {
        // Get total number of teachers
        const totalTeachers = await Teacher.countDocuments();

        // Get total number of students
        const totalStudents = await Student.countDocuments();

        // Get total number of courses
        const totalCourses = await Course.countDocuments();

        // Return the statistics
        res.status(200).json({
            totalTeachers,
            totalStudents,
            totalCourses
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
